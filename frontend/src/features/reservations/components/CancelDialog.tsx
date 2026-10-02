import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useRedirectToLoginOnUnauthorized } from "@/features/auth/hooks";
import { toApiError } from "@/lib/api-error";
import { useCancelReservation } from "../hooks";
import type { Reservation } from "../types";
import { ReservationSummary } from "./ReservationSummary";

/*
 * 予約のキャンセルの確認ダイアログ（docs/08 の 5.3）。
 *
 * | 状態                              | 表示・動作                                                |
 * |-----------------------------------|-----------------------------------------------------------|
 * | 送信中                            | 「キャンセル中...」。閉じられない                          |
 * | 成功                              | onCancelled を呼ぶ（閉じる・メッセージは MyReservationList）|
 * | 409 reservation_not_cancellable   | ダイアログの中にエラー。一覧は hook が取り直す             |
 *
 * - 閉じるボタンは「戻る」。R1 は「キャンセル」で、「予約のキャンセル」と紛らわしかった
 * - キャンセル料の注意書きは出さない（キャンセル料は取らない。docs/01 の C4）
 * - 失敗してもダイアログは閉じない（B17）
 *
 * MyReservationList の子として import されるので、"use client" は書かない。
 */

type Props = {
  /** キャンセルしようとしている予約。null なら閉じている */
  reservation: Reservation | null;
  onClose: () => void;
  /** キャンセルできた */
  onCancelled: () => void;
};

export function CancelDialog({ reservation, onClose, onCancelled }: Props) {
  const cancelReservation = useCancelReservation();
  // セッションが切れていたら（401）、ログイン画面へ
  useRedirectToLoginOnUnauthorized(cancelReservation.error);

  const close = () => {
    // 前回のエラーを残さない
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
  // 409 の後は、同じ予約はもうキャンセルできないので押せなくする
  const notCancellable = error?.code === "reservation_not_cancellable";

  return (
    <Dialog
      open={reservation !== null}
      onClose={close}
      title="予約をキャンセルしますか？"
      busy={cancelReservation.isPending}
    >
      {reservation && (
        <div className="space-y-4">
          <ReservationSummary
            date={reservation.date}
            startHour={reservation.start_hour}
            endHour={reservation.end_hour}
            price={reservation.price}
          />

          {error && <Alert tone="error">{error.message}</Alert>}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={close}
              disabled={cancelReservation.isPending}
            >
              戻る
            </Button>
            <Button
              variant="danger"
              onClick={submit}
              loading={cancelReservation.isPending}
              loadingText="キャンセル中..."
              disabled={notCancellable}
            >
              キャンセルする
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
