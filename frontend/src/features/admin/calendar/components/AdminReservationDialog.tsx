import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useRedirectToLoginOnUnauthorized } from "@/features/auth/hooks";
import { ReservationSummary } from "@/features/reservations/components/ReservationSummary";
import { toApiError } from "@/lib/api-error";
import { useAdminCancelReservation } from "../hooks";
import type { AdminReservation } from "../types";

/*
 * 管理画面の予約の詳細ダイアログ（docs/08 の 6.2）。予約済みの枠を押すと開く。
 *
 * | 状態                          | 表示・動作                                           |
 * |-------------------------------|------------------------------------------------------|
 * | 開始済み（is_cancellable が偽）| キャンセルボタンを出さない                           |
 * | キャンセル中                  | 「キャンセル中...」。閉じられない                    |
 * | 成功                          | onCancelled を呼ぶ（閉じる。カレンダーから消える）   |
 * | 失敗                          | ダイアログの中にエラー（B17。R1 は閉じてしまった）   |
 *
 * 会員の予約なら、キャンセルのボタンの上に「会員にキャンセルのメールが送られます」と出す（電話予約には出さない）。
 * AdminCalendar の子として import されるので、"use client" は書かない。
 */

type Props = {
  /** 詳細を出す予約。null なら閉じている */
  reservation: AdminReservation | null;
  onClose: () => void;
  onCancelled: () => void;
};

export function AdminReservationDialog({
  reservation,
  onClose,
  onCancelled,
}: Props) {
  const cancelReservation = useAdminCancelReservation();
  useRedirectToLoginOnUnauthorized(cancelReservation.error);

  const close = () => {
    cancelReservation.reset();
    onClose();
  };

  const submit = () => {
    if (!reservation) {
      return;
    }
    cancelReservation.mutate(reservation.id, {
      onSuccess: () => {
        cancelReservation.reset();
        onCancelled();
      },
    });
  };

  const error = cancelReservation.error
    ? toApiError(cancelReservation.error)
    : null;

  return (
    <Dialog
      open={reservation !== null}
      onClose={close}
      title="予約詳細"
      busy={cancelReservation.isPending}
    >
      {reservation && (
        <div className="space-y-4">
          <dl className="space-y-1 text-sm">
            <div className="flex gap-4">
              <dt className="w-20 shrink-0 text-zinc-500">予約者</dt>
              <dd className="font-medium text-zinc-900">
                {reservation.booker_name}
              </dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-20 shrink-0 text-zinc-500">種別</dt>
              <dd className="font-medium text-zinc-900">
                {reservation.is_phone ? "電話予約" : "会員"}
              </dd>
            </div>
          </dl>

          <ReservationSummary
            date={reservation.date}
            startHour={reservation.start_hour}
            endHour={reservation.end_hour}
            price={reservation.price}
          />

          {error && <Alert tone="error">{error.message}</Alert>}

          {reservation.is_cancellable && !reservation.is_phone && (
            <p className="text-xs text-zinc-500">
              会員にキャンセルのメールが送られます
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={close}
              disabled={cancelReservation.isPending}
            >
              閉じる
            </Button>
            {/* 開始済みの予約は、キャンセルボタンを出さない */}
            {reservation.is_cancellable && (
              <Button
                variant="danger"
                onClick={submit}
                loading={cancelReservation.isPending}
                loadingText="キャンセル中..."
                disabled={error?.code === "reservation_not_cancellable"}
              >
                この予約をキャンセル
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
