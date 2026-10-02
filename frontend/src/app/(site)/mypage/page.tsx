import { Accordion } from "@/components/ui/Accordion";
import { ProfileForm } from "@/features/auth/components/ProfileForm";
import { MyReservationList } from "@/features/reservations/components/MyReservationList";

/*
 * マイページ（/mypage。docs/08 の 5）。会員かどうかは mypage/layout.tsx がサーバーで判定済み。
 *
 * ページは Server Component のまま、動きのある部分（予約一覧・プロフィール設定）だけを Client Component にする。
 * R1 はページ全体が "use client" だった。
 */
export default function MypagePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900">マイページ</h1>

      <section aria-labelledby="my-reservations-heading" className="space-y-3">
        <h2
          id="my-reservations-heading"
          className="text-lg font-semibold text-zinc-900"
        >
          今後のご予約
        </h2>
        <MyReservationList />
      </section>

      {/* 押すと開く。開くまでフォームは描かない（Accordion） */}
      <Accordion title="プロフィール設定">
        <ProfileForm />
      </Accordion>
    </div>
  );
}
