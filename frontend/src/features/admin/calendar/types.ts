import type { ClosedReason, GridSlotStatus } from "@/features/calendar/types";
import type { Reservation } from "@/features/reservations/types";

/*
 * 管理者用のカレンダーの型。バックエンドの GET /api/admin/calendar の形（docs/03）と同じ。
 * （backend/app/Http/Resources/AdminCalendarDayResource.php・AdminReservationResource.php）
 */

/**
 * 管理者用の枠の状態。公開用の3つに、closed（受付外の日の、予約が無い枠）を足したもの。
 * 受付外の日も全部の枠を返し、予約がある枠は booked になる（B11）
 */
export type AdminSlotStatus = GridSlotStatus;

export type AdminCalendarSlot = {
  hour: number;
  status: AdminSlotStatus;
  /** 予約済みの枠に入っている予約の id。予約の中身は、その日の reservations から引く */
  reservation_id: number | null;
};

/** 管理画面の予約。会員向けの項目に、会員の id と電話予約かを足したもの */
export type AdminReservation = Reservation & {
  /** 予約した会員の id。電話予約・退会した会員の予約は null */
  user_id: number | null;
  /** 電話予約（会員と結びついていない予約）か。予約者名の前に「☎」を付ける */
  is_phone: boolean;
};

export type AdminCalendarDay = {
  date: string;
  closed_reason: ClosedReason | null;
  /** 営業時間の全部の枠。保持期間（3か月）より前の日は [] */
  slots: AdminCalendarSlot[];
  /** その日の確定済みの予約（開始の早い順） */
  reservations: AdminReservation[];
};

export type AdminCalendarResponse = {
  meta: { today: string; bookable_until: string };
  data: AdminCalendarDay[];
};

/** 電話予約の入力（POST /api/admin/reservations） */
export type CreatePhoneReservationInput = {
  date: string;
  start_hour: number;
  end_hour: number;
  booker_name: string;
};
