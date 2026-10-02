import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { UserProvider } from "@/features/auth/components/UserProvider";
import { getCurrentUser } from "@/features/auth/server";

/*
 * 管理画面のレイアウト。管理者だけが見られる（docs/05 の「サーバー側での保護」、D9）。
 *
 * | 誰が開いたか | 動き                 |
 * |--------------|----------------------|
 * | 未ログイン   | /login へ移す        |
 * | 会員         | / へ移す             |
 * | 管理者       | 描く                 |
 *
 * この判定は「画面の出し分け」のためで、守りは API 側の can:admin（docs/04 の「認可」）。
 * 利用者向けのページ（(site)）の外に置くので、フッターは出さない。
 */

export const metadata: Metadata = {
  // ルートのレイアウトの template で「管理画面｜（施設名）」になる（docs/08 の 8）
  title: "管理画面",
  robots: { index: false },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/");
  }

  return (
    <UserProvider initialUser={user}>
      <main className="w-full flex-1">{children}</main>
    </UserProvider>
  );
}
