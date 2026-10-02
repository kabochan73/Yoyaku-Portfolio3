"use client";

import { HolidayForm } from "./HolidayForm";
import { HolidayList } from "./HolidayList";

/*
 * 臨時休業日の管理（docs/08 の 6.6）。管理画面の「臨時休業日」のアコーディオンの中に出す。
 * 上に追加のフォーム、下に今日以降の一覧を並べる。
 * 追加・削除の後は、一覧とカレンダーを hook が取り直す（features/admin/holidays/hooks.ts）。
 */
export function HolidayManager() {
  return (
    <div className="space-y-6">
      <HolidayForm />
      <HolidayList />
    </div>
  );
}
