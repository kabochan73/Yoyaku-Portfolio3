import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ApiError } from "@/lib/api-error";
import { queryKeys } from "@/lib/query-keys";
import {
  cancelReservation,
  createReservation,
  fetchMyReservations,
} from "./api";

/*
 * 予約の hook（docs/05 の「更新後に取り直すデータ」）。
 *
 * 予約・キャンセルが成功したら、影響するデータに「古い」と印を付けて取り直させる（invalidateQueries）。
 * 印を付けると、新しいとみなす時間（カレンダーは60秒）の間でも、すぐ取り直す。
 * 自分の操作が画面に出ないことはない。
 *
 * | 操作               | 取り直すもの                         |
 * |--------------------|--------------------------------------|
 * | 予約（会員）       | カレンダーの全部の週・自分の予約一覧 |
 * | キャンセル（会員） | カレンダーの全部の週・自分の予約一覧 |
 */

/**
 * 自分の今日以降の予約（マイページ）。
 * タブに戻ったときは毎回取り直す（TanStack Query の既定。定期取得はしない。docs/05 の表）。
 */
export function useMyReservations() {
  return useQuery({
    queryKey: queryKeys.myReservations,
    queryFn: fetchMyReservations,
  });
}

/** 予約・キャンセルの後に、カレンダーと自分の予約一覧を取り直させる */
function invalidateAfterChange(queryClient: QueryClient) {
  // calendar.all（["calendar"]）で始まるキー = 全部の週
  void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.myReservations });
}

/** 409 で、決まった code のエラーか */
function isConflict(error: Error, code: string): boolean {
  return (
    error instanceof ApiError && error.status === 409 && error.code === code
  );
}

/**
 * 予約する。
 *
 * 409 slot_taken（その時間帯は先に予約された）のときは、カレンダーを取り直す。
 * 画面には古い「空き」が出ていたので、埋まったことをすぐ見せる（docs/03 の「422 と 409 の使い分け」）。
 * サーバー側でも、その日のキャッシュは消してある（CreateReservation の保険）。
 */
export function useCreateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createReservation,
    onSuccess: () => invalidateAfterChange(queryClient),
    onError: (error) => {
      if (isConflict(error, "slot_taken")) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.calendar.all,
        });
      }
    },
  });
}

/**
 * 自分の予約をキャンセルする。
 *
 * 409 reservation_not_cancellable（開始済み・キャンセル済み）のときは、予約一覧を取り直す。
 * 画面に古い状態（まだキャンセルできるように見える）が出ていたので、今の状態に直す（docs/08 の 5.3）。
 */
export function useCancelReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelReservation,
    onSuccess: () => invalidateAfterChange(queryClient),
    onError: (error) => {
      if (isConflict(error, "reservation_not_cancellable")) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.myReservations,
        });
      }
    },
  });
}
