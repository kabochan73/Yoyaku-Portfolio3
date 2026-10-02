import { AdminCalendar } from "@/features/admin/calendar/components/AdminCalendar";

/*
 * 管理画面（/admin。docs/08 の 6）。R1 と同じく1ページ構成。
 * 管理者かどうかは admin/layout.tsx がサーバーで判定済み。
 *
 * カレンダーを上に常に出し、設定は下のアコーディオン（開いたときに初めて中身を読み込む）に並べる。
 * 料金・定休日・臨時休業日・ユーザー検索・プロフィールの設定は、7-7〜7-9 でここに足す。
 */
export default function AdminPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900">管理画面</h1>
      <AdminCalendar />
    </div>
  );
}
