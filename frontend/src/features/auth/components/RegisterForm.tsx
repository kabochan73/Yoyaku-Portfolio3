"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { applyServerErrors } from "@/lib/form-errors";
import { useRegister } from "../hooks";
import { registerSchema, type RegisterValues } from "../schemas";

/*
 * 会員登録のフォーム（docs/08 の 4）。
 *
 * | 状態         | 表示・動作                                                  |
 * |--------------|-------------------------------------------------------------|
 * | 入力の間違い | 入力欄の下（送信しない）                                    |
 * | 送信中       | ボタン「登録中...」。押せない                               |
 * | 422          | 項目ごとに、その入力欄の下（メールの重複はメール欄の下）    |
 * | 429 など     | フォームの上                                                |
 * | 成功         | ログインした状態になり、トップへ                            |
 *
 * R1 はサーバーのエラーを最初の1件だけ、フォームの下に出していた。
 */

/** サーバーのエラーを入力欄の下に出せる項目 */
const FIELDS = ["name", "email", "password", "password_confirmation"] as const;

export function RegisterForm() {
  const router = useRouter();
  const registerMutation = useRegister();
  // フォームの上に出すエラー（入力欄に当てはまらないもの）
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      password_confirmation: "",
    },
  });

  const onSubmit = (values: RegisterValues) => {
    setFormError(null);
    registerMutation.mutate(values, {
      // replace にして、戻るボタンで登録画面に戻らないようにする
      onSuccess: () => router.replace("/"),
      onError: (error) =>
        setFormError(applyServerErrors(error, setError, FIELDS)),
    });
  };

  // 成功した後も、移動が終わるまでは押せないままにする（もう一度送信されないように）
  const busy = registerMutation.isPending || registerMutation.isSuccess;

  return (
    // noValidate: ブラウザ標準の入力チェックの吹き出しを出さず、zod のチェックにそろえる
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}

      <FormField
        id="register-name"
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
        id="register-email"
        label="メールアドレス"
        error={errors.email?.message}
      >
        {(control) => (
          <input
            type="email"
            autoComplete="email"
            placeholder="example@mail.com"
            {...control}
            {...register("email")}
          />
        )}
      </FormField>

      <FormField
        id="register-password"
        label="パスワード"
        hint="8文字以上"
        error={errors.password?.message}
      >
        {(control) => (
          <input
            type="password"
            // new-password: パスワード管理ツールに「新しいパスワード」だと伝え、強いパスワードを提案させる
            autoComplete="new-password"
            {...control}
            {...register("password")}
          />
        )}
      </FormField>

      <FormField
        id="register-password-confirmation"
        label="パスワード（確認）"
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

      <Button
        type="submit"
        className="w-full"
        loading={busy}
        loadingText="登録中..."
      >
        登録する
      </Button>
    </form>
  );
}
