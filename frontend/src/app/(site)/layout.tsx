import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { getFacility } from "@/features/facility/server";

/*
 * 利用者向けのページ（トップ・マイページ）に共通のレイアウト（docs/08 の 2）。
 *
 *   ルートのレイアウト（Header） → このレイアウト（<main> と Footer） → 各ページ
 *
 * Footer に出す施設情報を、ここで getFacility() から取る。
 * getFacility() は Cookie を読まず、結果は Next.js に1時間保存される（タグ facility）ので、
 * トップページは静的なまま。マイページ（手順6）はアクセスごとに描くが、施設情報は保存したものを使う。
 *
 * ここでは Cookie を読まない（cookies() / getCurrentUser() を呼ばない）。
 * 読むと、この下のトップページも静的でなくなる（docs/05 の「トップは静的」）。
 */
export default async function SiteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const facility = await getFacility();

  return (
    <>
      <main className="w-full flex-1">{children}</main>
      <Footer facility={facility} />
    </>
  );
}
