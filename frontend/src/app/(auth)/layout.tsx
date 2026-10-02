import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/server";

/*
 * ログイン・会員登録の画面に共通のレイアウト（docs/05 の「サーバー側での保護」、docs/08 の 4）。
 *
 * すでにログインしている人は、フォームを描く前にサーバーで移動させる（管理者 → /admin、会員 → /）。
 * R1 はページを "use client" にして、描いた後に useEffect で移動していたので、一瞬フォームが見えていた。
 *
 * getCurrentUser() は Cookie を読むので、この下のページはアクセスごとに描かれる（静的にはならない）。
 */
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/");
  }

  return (
    <main className="flex w-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}
