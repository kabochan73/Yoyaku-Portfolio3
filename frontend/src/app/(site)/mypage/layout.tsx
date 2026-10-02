import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { UserProvider } from "@/features/auth/components/UserProvider";
import { getCurrentUser } from "@/features/auth/server";

/*
 * マイページのレイアウト。会員だけが見られる（docs/05 の「サーバー側での保護」、D9）。
 *
 * | 誰が開いたか | 動き                                                      |
 * |--------------|-----------------------------------------------------------|
 * | 未ログイン   | /login へ移す                                             |
 * | 管理者       | /admin へ移す（管理者はマイページを使わない。R1 と同じ）  |
 * | 会員         | 描く。取ったユーザーを UserProvider でブラウザに渡す       |
 *
 * サーバーで判定してから描くので、未ログインの人にマイページの中身が一瞬見えることはない。
 * R1 はページを "use client" にして、描いた後に useEffect で移動していた。
 * この判定は「画面の出し分け」のためで、守りは API 側の auth:sanctum（docs/05）。
 *
 * getCurrentUser() は Cookie を読むので、マイページはアクセスごとに描かれる（静的にはならない）。
 */

export const metadata: Metadata = {
  // ルートのレイアウトの template で「マイページ｜（施設名）」になる（docs/08 の 8）
  title: "マイページ",
  // 個人のページなので、検索エンジンに載せない
  robots: { index: false },
};

export default async function MypageLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (user.role === "admin") {
    redirect("/admin");
  }

  return <UserProvider initialUser={user}>{children}</UserProvider>;
}
