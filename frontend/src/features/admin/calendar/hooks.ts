import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { ApiError } from "@/lib/api-error";
import { addDays } from "@/lib/date";
import { CALENDAR_FRESH_MS, CALENDAR_POLL_MS } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";
import {
  adminCancelReservation,
  createPhoneReservation,
  fetchAdminCalendar,
} from "./api";

/*
 * 管理者用のカレンダーの hook（docs/05 の「週間カレンダー」「更新後に取り直すデータ」）。
 *
 * 取り方（1週間 = 1回・60秒ごとに取り直す・週の切り替え中は前の週を出したまま・次の週の先読み）は、
 * 会員用の useCalendar（features/calendar/hooks.ts）と同じ。違うのは呼ぶ API と、先読みに上限が無いこと
 * （管理者は予約できる最終日より先の週も見られる。docs/08 の 6.1）。
 *
 * | 操作                         | 取り直すもの                                   |
 * |------------------------------|------------------------------------------------|
 * | 電話予約・キャンセル（管理者）| 管理者用のカレンダー・公開用のカレンダー      |
 */

/** 1週間分（月曜〜日曜）の取り方 */
function adminCalendarWeekOptions(weekStart: string) {
  return queryOptions({
    queryKey: queryKeys.admin.calendar.week(weekStart),
    queryFn: () => fetchAdminCalendar(weekStart, addDays(weekStart, 6)),
    staleTime: CALENDAR_FRESH_MS,
  });
}

/**
 * 1週間分の管理者用のカレンダー。
 * @param weekStart 表示する週の月曜日（"2026-10-05"）
 */
export function useAdminCalendar(weekStart: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    ...adminCalendarWeekOptions(weekStart),
    refetchInterval: CALENDAR_POLL_MS,
    placeholderData: keepPreviousData,
  });

  // 次の週を先読みする（管理者は先の週にも進めるので、上限は付けない）
  useEffect(() => {
    void queryClient.prefetchQuery(
      adminCalendarWeekOptions(addDays(weekStart, 7)),
    );
  }, [queryClient, weekStart]);

  return query;
}

/** 管理者の操作の後に、管理者用と公開用のカレンダーを取り直させる */
function invalidateCalendars(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.admin.calendar.all,
  });
  void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
}

/** 409 で、決まった code のエラーか */
function isConflict(error: Error, code: string): boolean {
  return (
    error instanceof ApiError && error.status === 409 && error.code === code
  );
}

/**
 * 電話予約を登録する。
 * 409 slot_taken のときは、管理者用のカレンダーを取り直す（埋まった枠をすぐ見せる）。
 */
export function useCreatePhoneReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPhoneReservation,
    onSuccess: () => invalidateCalendars(queryClient),
    onError: (error) => {
      if (isConflict(error, "slot_taken")) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.admin.calendar.all,
        });
      }
    },
  });
}

/**
 * 予約をキャンセルする（管理者）。
 * 409 reservation_not_cancellable のときは、管理者用のカレンダーを取り直す（今の状態に直す）。
 */
export function useAdminCancelReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adminCancelReservation,
    onSuccess: () => invalidateCalendars(queryClient),
    onError: (error) => {
      if (isConflict(error, "reservation_not_cancellable")) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.admin.calendar.all,
        });
      }
    },
  });
}
