import { FacilityInfo } from "@/features/facility/components/FacilityInfo";
import { Hero } from "@/features/facility/components/Hero";
import { RulesSection } from "@/features/facility/components/RulesSection";
import { getFacility } from "@/features/facility/server";

/*
 * トップページ（/。docs/08 の 3）。
 *
 * 【静的ページ（ISR）】
 * ビルドのときに HTML を作り、訪れた人には作っておいた HTML を返す（API も DB も呼ばない）。
 * 施設情報は getFacility() が Next.js に保存したもの（タグ facility・1時間）を使う。
 * 料金などを変えたときは、バックエンドが /internal/revalidate を呼んで作り直させる（手順7）。
 *
 * 静的なままにするため、ここでは Cookie を読まない（cookies() / getCurrentUser() を呼ばない）。
 * ログイン状態はヘッダーが、空き状況はカレンダー（5-7）が、ブラウザで取る。
 *
 * getFacility() は (site)/layout.tsx でも呼んでいるが、同じ保存したものを使うので、API を呼ぶのは1回。
 */
export default async function Home() {
  const facility = await getFacility();

  return (
    <>
      <Hero facility={facility} />
      <FacilityInfo facility={facility} />
      {/* 週間カレンダー（BookingCalendar）は 5-7 でここに入れる */}
      <RulesSection />
    </>
  );
}
