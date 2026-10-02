import { Button } from "@/components/ui/Button";
import { formatDateJa, formatHourRange, formatYen } from "@/lib/format";
import type { Reservation, ReservationPhase } from "../types";

/*
 * マイページの予約1件のカード（docs/08 の 5.2）。
 *
 *   2026年10月6日（火）
 *   12:00 〜 14:00（2時間）
 *   ¥8,000                       [キャンセル]
 *
 * キャンセルできる予約（is_cancellable。確定済み かつ 開始前）だけに「キャンセル」ボタンを出す。
 * 今日の始まった予約は、ボタンの代わりに「ご利用中」「ご利用済み」と出す（C2）。
 * R1 は今日の予約なら、終わった後でもキャンセルボタンが出ていた。
 * どちらにするかはサーバーが返す is_cancellable・phase で決める（端末の時計と比べない）。
 *
 * MyReservationList の子として import されるので、"use client" は書かない。
 */

type Props = {
  reservation: Reservation;
  /** 「キャンセル」を押した（確認ダイアログを開く） */
  onCancel: (reservation: Reservation) => void;
};

/** キャンセルできないときに、ボタンの代わりに出す文言 */
const PHASE_LABELS: Record<ReservationPhase, string> = {
  before_start: "",
  in_use: "ご利用中",
  finished: "ご利用済み",
};

export function ReservationCard({ reservation, onCancel }: Props) {
  const { date, start_hour, end_hour, hours, price } = reservation;

  return (
    <li className="flex items-end justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div>
        <p className="font-semibold text-zinc-900">{formatDateJa(date)}</p>
        <p className="text-sm text-zinc-700">
          {formatHourRange(start_hour, end_hour)}（{hours}時間）
        </p>
        <p className="text-sm text-zinc-700">{formatYen(price)}</p>
      </div>

      {reservation.is_cancellable ? (
        <Button
          variant="danger"
          size="sm"
          onClick={() => onCancel(reservation)}
          // 画面読み上げでは、どの予約のキャンセルか分かるようにする
          aria-label={`${formatDateJa(date)} ${formatHourRange(start_hour, end_hour)} の予約をキャンセル`}
        >
          キャンセル
        </Button>
      ) : (
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
          {PHASE_LABELS[reservation.phase]}
        </span>
      )}
    </li>
  );
}
