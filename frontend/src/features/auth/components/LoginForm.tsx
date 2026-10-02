"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { applyServerErrors } from "@/lib/form-errors";
import { useLogin } from "../hooks";
import { loginSchema, type LoginValues } from "../schemas";

/*
 * ログインのフォーム（docs/08 の 4）。
 *
 * | 状態         | 表示・動作                                                  |
 * |--------------|-------------------------------------------------------------|
 * | 入力の間違い | 入力欄の下（送信しない）                                    |
 * | 送信中       | ボタン「ログイン中...」。押せない                           |
 * | 422          | フォームの上に「メールアドレスまたはパスワードが…」        |
 * | 429          | フォームの上に「試行回数が多すぎます…」                    |
 * | 成功         | 管理者 → /admin、会員 → /                                  |
 *
 * R1 はページ全体が "use client" で、送信中・エラーの状態も useState で手書きしていた。
 * R2 はページは Server Component のまま、フォームだけをこの部品に切り出す。
 */
export function LoginForm() {
  const router = useRouter();
  const loginMutation = useLogin();
  // フォームの上に出すエラー（入力欄に当てはまらないもの）
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: LoginValues) => {
    setFormError(null);
    loginMutation.mutate(values, {
      onSuccess: (user) => {
        // replace にして、戻るボタンでログイン画面に戻らないようにする
        router.replace(user.role === "admin" ? "/admin" : "/");
      },
      onError: (error) => {
        setFormError(applyServerErrors(error, setError, ["email", "password"]));
      },
    });
  };

  // 成功した後も、移動が終わるまでは押せないままにする（もう一度送信されないように）
  const busy = loginMutation.isPending || loginMutation.isSuccess;

  return (
    // noValidate: ブラウザ標準の入力チェックの吹き出しを出さず、zod のチェックにそろえる
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}

      <FormField
        id="login-email"
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
        id="login-password"
        label="パスワード"
        error={errors.password?.message}
      >
        {(control) => (
          <input
            type="password"
            autoComplete="current-password"
            {...control}
            {...register("password")}
          />
        )}
      </FormField>

      <Button
        type="submit"
        className="w-full"
        loading={busy}
        loadingText="ログイン中..."
      >
        ログイン
      </Button>
    </form>
  );
}
