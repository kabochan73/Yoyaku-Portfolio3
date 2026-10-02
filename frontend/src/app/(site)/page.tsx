import { FacilityInfo } from "@/features/facility/components/FacilityInfo";
import { FacilityProvider } from "@/features/facility/components/FacilityProvider";
import { Hero } from "@/features/facility/components/Hero";
import { RulesSection } from "@/features/facility/components/RulesSection";
import { getFacility } from "@/features/facility/server";
import { BookingCalendar } from "@/features/reservations/components/BookingCalendar";

/*
 * トップページ（/。docs/08 の 3）。
 *
 * 【静的ページ（ISR）】
 * ビルドのときに HTML を作り、訪れた人には作っておいた HTML を返す（API も DB も呼ばない）。
 * 施設情報は getFacility() が Next.js に保存したもの（タグ facility・1時間）を使う。
 * 料金などを変えたときは、バックエンドが /internal/revalidate を呼んで作り直させる（手順7）。
 *
 * 静的なままにするため、ここでは Cookie を読まない（cookies() / getCurrentUser() を呼ばない）。
 * ログイン状態はヘッダーが、空き状況はカレンダー（BookingCalendar）が、ブラウザで取る。
 *
 * getFacility() は (site)/layout.tsx でも呼んでいるが、同じ保存したものを使うので、API を呼ぶのは1回。
 */
export default async function Home() {
  const facility = await getFacility();

  return (
    <>
      <Hero facility={facility} />
      <FacilityInfo facility={facility} />
      {/*
        週間カレンダー（Client Component）。空き状況はブラウザで取る（静的な HTML には入れない）。
        FacilityProvider で、サーバーで取った施設情報を渡す（カレンダーは useFacility() で営業時間などを読む。
        ブラウザから /api/facility は呼ばない）
      */}
      <FacilityProvider facility={facility}>
        <BookingCalendar />
      </FacilityProvider>
      <RulesSection />
    </>
  );
}
