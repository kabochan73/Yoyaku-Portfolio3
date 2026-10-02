import {
  keepPreviousData,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { addDays } from "@/lib/date";
import { CALENDAR_FRESH_MS, CALENDAR_POLL_MS } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";
import { fetchCalendar } from "./api";

/*
 * ブラウザでカレンダー（空き状況）を取る hook（docs/05 の「週間カレンダー」「他の人の操作の反映」）。
 *
 * 空き状況はトップの静的な HTML には入れず、ブラウザが取る（予約のたび・時刻の経過で変わるため）。
 * サーバー側では日ごとの事実が Redis にキャッシュされ（CalendarFacts）、変化が無ければ 304 が返る。
 */

/**
 * 1週間分（月曜〜日曜）の取り方。useCalendar と、次の週の先読みで同じものを使う。
 *
 * - 1週間 = 1回の通信（D13）。R1 は月単位で取り、月をまたぐ週では2か月分を取って合わせていた
 * - 取ってから60秒間は「新しい」とみなす（staleTime）。週を行き来したり、タブを切り替えて戻ったりしても、
 *   60秒以内なら手元のデータを使い、サーバーを呼ばない（2026-09-29 決定）
 *
 * @param weekStart その週の月曜日（"2026-10-05"）
 */
function calendarWeekOptions(weekStart: string) {
  return queryOptions({
    queryKey: queryKeys.calendar.week(weekStart),
    queryFn: () => fetchCalendar(weekStart, addDays(weekStart, 6)),
    staleTime: CALENDAR_FRESH_MS,
  });
}

/**
 * 1週間分の空き状況。
 *
 * - 表示している間は60秒ごとに取り直す（refetchInterval）。他の人の予約は、最大60秒で画面に出る。
 *   タブが裏にあるときは止まる（TanStack Query の既定）。WebSocket は使わない（2026-09-29 決定。B5）
 * - 週を切り替えている間は、前の週のデータを出したままにする（placeholderData: keepPreviousData）。
 *   画面を一瞬空にしない。そのあいだ isPlaceholderData が true になるので、画面はそれを見て薄く表示する（docs/08 の 3.1）
 * - 次の週を先読みしておき、「次の週」を押したときにすぐ出せるようにする。
 *   ただし予約できる最終日（meta.bookable_until）を含む週より先は、進めないので読まない（B13）
 *
 * @param weekStart 表示する週の月曜日（"2026-10-05"）
 */
export function useCalendar(weekStart: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    ...calendarWeekOptions(weekStart),
    refetchInterval: CALENDAR_POLL_MS,
    placeholderData: keepPreviousData,
  });

  // 予約できる最終日。データが届くまでは分からないので、先読みもしない
  const bookableUntil = query.data?.meta.bookable_until;

  useEffect(() => {
    if (bookableUntil === undefined) {
      return;
    }

    const nextWeekStart = addDays(weekStart, 7);
    // 次の週の月曜が最終日より後なら、次の週には進めない。
    // "YYYY-MM-DD" の文字列は、そのまま大小を比べれば日付の前後になる
    if (nextWeekStart > bookableUntil) {
      return;
    }

    // すでに新しいデータを持っていれば（60秒以内に取っていれば）、prefetchQuery は何もしない
    void queryClient.prefetchQuery(calendarWeekOptions(nextWeekStart));
  }, [queryClient, weekStart, bookableUntil]);

  return query;
}
