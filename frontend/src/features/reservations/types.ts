/*
 * 予約の型。バックエンドの ReservationResource（backend/app/Http/Resources/ReservationResource.php）と同じ形（docs/03）。
 */

/**
 * 今の時刻から見た段階。サーバーが決める（端末の時計と比べない）。
 * before_start = 開始前、in_use = 利用中、finished = 終了
 */
export type ReservationPhase = "before_start" | "in_use" | "finished";

export type Reservation = {
  id: number;
  /** 利用日（"2026-10-06"） */
  date: string;
  /** 開始の時（12 = 12:00） */
  start_hour: number;
  /** 終了の時（14 = 14:00。この時刻は含まない） */
  end_hour: number;
  /** 利用時間（時間数） */
  hours: number;
  /** 予約した時点の金額（円）。確定の金額はこれ（D8） */
  price: number;
  status: "confirmed" | "cancelled";
  phase: ReservationPhase;
  /** キャンセルできるか（確定済み かつ 開始前）。マイページの「キャンセル」ボタンを出すかに使う */
  is_cancellable: boolean;
  booker_name: string;
};

/** 予約の入力（POST /api/reservations）。時は整数で送る（D6） */
export type CreateReservationInput = {
  date: string;
  start_hour: number;
  end_hour: number;
};
