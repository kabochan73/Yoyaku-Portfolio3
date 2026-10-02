import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

/*
 * 会員登録画面（/register。docs/08 の 4）。
 * ページは Server Component のまま、動きのあるフォームだけを RegisterForm（Client Component）にする。
 */

// ルートのレイアウトの template で「会員登録｜（施設名）」になる（docs/08 の 8）
export const metadata: Metadata = {
  title: "会員登録",
};

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-8 text-center text-2xl font-bold text-zinc-900">
        会員登録
      </h1>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-zinc-500">
        すでにアカウントをお持ちの方は{" "}
        <Link
          href="/login"
          className="font-medium text-green-600 underline underline-offset-2"
        >
          ログイン
        </Link>
      </p>
    </>
  );
}
