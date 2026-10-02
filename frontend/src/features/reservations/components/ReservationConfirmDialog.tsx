import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useCurrentUser } from "@/features/auth/hooks";
import { useFacility } from "@/features/facility/hooks";
import { estimatePrice } from "@/features/facility/price";
import { toApiError } from "@/lib/api-error";
import { useCreateReservation } from "../hooks";
import type { Reservation } from "../types";
import { ReservationSummary } from "./ReservationSummary";

/*
 * 予約内容の確認ダイアログ（docs/08 の 3.6）。カレンダーで開始と終了の枠を選び終わったら開く。
 *
 * | 状態                         | 表示・動作                                                      |
 * |------------------------------|-----------------------------------------------------------------|
 * | 未ログイン                   | 「予約にはログインが必要です」+「ログインして予約」（/login へ）|
 * | 送信中                       | 「予約中...」。閉じられない                                     |
 * | 成功                         | onReserved を呼ぶ（閉じる・完了のメッセージは BookingCalendar） |
 * | 422                          | ダイアログの中にエラー                                          |
 * | 409 slot_taken               | ダイアログの中にエラー。「予約する」を押せなくする              |
 * | 409 already_booked_that_day  | ダイアログの中にエラー +「マイページで確認」                    |
 *
 * 失敗してもダイアログは閉じず、中にエラーを出す（B17。R1 はダイアログを閉じてしまい、エラーが見えない所があった）。
 * BookingCalendar の子として import されるので、"use client" は書かない（自動で Client Component になる）。
 */

/** 選び終わった時間帯 */
export type SelectedSlot = {
  date: string;
  startHour: number;
  endHour: number;
};

type Props = {
  /** 選んだ時間帯。null なら閉じている */
  slot: SelectedSlot | null;
  /** 閉じる（戻る・Esc・背景のクリック） */
  onClose: () => void;
  /** 予約できた。サーバーが返した予約（確定の金額入り）を渡す */
  onReserved: (reservation: Reservation) => void;
};

export function ReservationConfirmDialog({ slot, onClose, onReserved }: Props) {
  const { data: user, isPending: userLoading } = useCurrentUser();
  const { data: facility } = useFacility();
  const createReservation = useCreateReservation();

  const close = () => {
    // 前回のエラーを残さない（次に開いたときに、古いエラーが出ないように）
    createReservation.reset();
    onClose();
  };

  const submit = () => {
    if (!slot) {
      return;
    }
    createReservation.mutate(
      { date: slot.date, start_hour: slot.startHour, end_hour: slot.endHour },
      {
        onSuccess: (reservation) => {
          createReservation.reset();
          onReserved(reservation);
        },
      },
    );
  };

  const error = createReservation.error
    ? toApiError(createReservation.error)
    : null;
  // 409 slot_taken のあとは、同じ枠ではもう予約できないので押せなくする（カレンダーは hook が取り直す）
  const slotTaken = error?.code === "slot_taken";

  return (
    <Dialog
      open={slot !== null}
      onClose={close}
      title="予約内容の確認"
      busy={createReservation.isPending}
    >
      {slot && facility && (
        <div className="space-y-4">
          <ReservationSummary
            date={slot.date}
            startHour={slot.startHour}
            endHour={slot.endHour}
            price={estimatePrice(
              slot.date,
              slot.endHour - slot.startHour,
              facility.prices,
            )}
            priceNote="（見積もり）"
          />

          {error && (
            <Alert tone="error">
              <p>{errorMessage(error)}</p>
              {error.code === "already_booked_that_day" && (
                <Link
                  href="/mypage"
                  className="mt-1 inline-block font-medium underline"
                >
                  マイページで確認
                </Link>
              )}
            </Alert>
          )}

          {!userLoading && !user && (
            <p className="text-sm text-zinc-700">
              予約にはログインが必要です。
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={close}
              disabled={createReservation.isPending}
            >
              戻る
            </Button>
            {!userLoading && !user ? (
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                ログインして予約
              </Link>
            ) : (
              <Button
                onClick={submit}
                loading={createReservation.isPending}
                loadingText="予約中..."
                // ユーザーを読み込み中・409 slot_taken の後は押せない
                disabled={userLoading || slotTaken}
              >
                予約する
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/**
 * ダイアログに出すエラーの文言。
 * 422 は項目ごとのエラー（例: start_hour「開始時刻を過ぎています。」）の最初の1件を出す。
 * 入力欄の無いダイアログなので、項目の下ではなく、まとめて1か所に出す。
 */
function errorMessage(error: ReturnType<typeof toApiError>): string {
  const firstFieldError = Object.values(error.fieldErrors)[0]?.[0];
  return firstFieldError ?? error.message;
}
