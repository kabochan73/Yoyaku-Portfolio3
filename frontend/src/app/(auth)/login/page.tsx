import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components/LoginForm";

/*
 * ログイン画面（/login。docs/08 の 4）。
 * ページは Server Component のまま、動きのあるフォームだけを LoginForm（Client Component）にする。
 */

// TODO(手順5): 施設名は getFacility() から取る（D14、docs/08 の 8）
export const metadata: Metadata = {
  title: "ログイン｜FUTSAL PARK",
};

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-8 text-center text-2xl font-bold text-zinc-900">
        ログイン
      </h1>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-zinc-500">
        アカウントをお持ちでない方は{" "}
        <Link
          href="/register"
          className="font-medium text-green-600 underline underline-offset-2"
        >
          新規登録
        </Link>
      </p>
    </>
  );
}
