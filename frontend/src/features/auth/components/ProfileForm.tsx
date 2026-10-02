"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { applyServerErrors } from "@/lib/form-errors";
import {
  useCurrentUser,
  useRedirectToLoginOnUnauthorized,
  useUpdateProfile,
} from "../hooks";
import { profileSchema, type ProfileValues } from "../schemas";

/*
 * プロフィール設定のフォーム（docs/08 の 5.4）。マイページと管理画面（手順7）で共通。
 *
 * | 状態   | 表示・動作                                                                     |
 * |--------|--------------------------------------------------------------------------------|
 * | 初期値 | 名前・メールは今の値。パスワードの欄は空                                       |
 * | 送信中 | 「更新中...」                                                                  |
 * | 422    | 項目ごと（現在のパスワード違いは「現在のパスワード」の欄の下）               |
 * | 成功   | 「プロフィールを更新しました」。パスワードの欄を空に戻す。ヘッダーの表示も変わる |
 *
 * 「更新しました」は、次に入力を変えたら消す（見た目が変わらない操作なので、知らせを出す。docs/08 の 1.1）。
 * R1 は「現在のパスワードが正しくありません」を、項目ではなく全体のメッセージで出していた。
 *
 * ログイン中のユーザーは、マイページでは UserProvider がサーバーで取った値を入れているので、最初から読める。
 */

/** パスワードの欄を空にした値 */
const EMPTY_PASSWORDS = {
  current_password: "",
  password: "",
  password_confirmation: "",
};

export function ProfileForm() {
  const { data: user } = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const [saved, setSaved] = useState(false);
  // フォームの上に出すエラー（入力欄に当てはまらないもの。429・500 など）
  const [formError, setFormError] = useState<string | null>(null);

  // セッションが切れていたら（401）、ログイン画面へ
  useRedirectToLoginOnUnauthorized(updateProfile.error);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      ...EMPTY_PASSWORDS,
    },
  });

  const onSubmit = (values: ProfileValues) => {
    setFormError(null);
    setSaved(false);
    updateProfile.mutate(values, {
      onSuccess: (updated) => {
        // 新しい名前・メールを初期値にし、パスワードの欄は空に戻す
        reset({ name: updated.name, email: updated.email, ...EMPTY_PASSWORDS });
        setSaved(true);
      },
      onError: (error) => {
        setFormError(
          applyServerErrors(error, setError, [
            "name",
            "email",
            "current_password",
            "password",
            "password_confirmation",
          ]),
        );
      },
    });
  };

  return (
    // noValidate: ブラウザ標準の入力チェックの吹き出しを出さず、zod のチェックにそろえる
    <form
      onSubmit={handleSubmit(onSubmit)}
      // 入力が変わったら「更新しました」を消す（入力欄の変化は、フォームまで伝わってくる）
      onChange={() => setSaved(false)}
      noValidate
      className="space-y-5"
    >
      {saved && <Alert tone="success">プロフィールを更新しました</Alert>}
      {formError && <Alert tone="error">{formError}</Alert>}

      <FormField
        id="profile-name"
        label="名前"
        hint="20文字以内"
        error={errors.name?.message}
      >
        {(control) => (
          <input
            type="text"
            autoComplete="name"
            {...control}
            {...register("name")}
          />
        )}
      </FormField>

      <FormField
        id="profile-email"
        label="メールアドレス"
        error={errors.email?.message}
      >
        {(control) => (
          <input
            type="email"
            autoComplete="email"
            {...control}
            {...register("email")}
          />
        )}
      </FormField>

      <fieldset className="space-y-5">
        <legend className="mb-2 text-sm text-zinc-500">
          パスワードを変更するときだけ入力してください
        </legend>

        <FormField
          id="profile-current-password"
          label="現在のパスワード"
          error={errors.current_password?.message}
        >
          {(control) => (
            <input
              type="password"
              autoComplete="current-password"
              {...control}
              {...register("current_password")}
            />
          )}
        </FormField>

        <FormField
          id="profile-password"
          label="新しいパスワード"
          hint="8文字以上"
          error={errors.password?.message}
        >
          {(control) => (
            <input
              type="password"
              autoComplete="new-password"
              {...control}
              {...register("password")}
            />
          )}
        </FormField>

        <FormField
          id="profile-password-confirmation"
          label="新しいパスワード（確認）"
          error={errors.password_confirmation?.message}
        >
          {(control) => (
            <input
              type="password"
              autoComplete="new-password"
              {...control}
              {...register("password_confirmation")}
            />
          )}
        </FormField>
      </fieldset>

      <Button
        type="submit"
        loading={updateProfile.isPending}
        loadingText="更新中..."
      >
        更新する
      </Button>
    </form>
  );
}
