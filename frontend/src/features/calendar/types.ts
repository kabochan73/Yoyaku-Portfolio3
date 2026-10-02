/*
 * カレンダーの型。バックエンドの GET /api/calendar の形（docs/03）と同じ。
 * （backend/app/Http/Resources/CalendarDayResource.php と CalendarController.php）
 */

/** 枠の状態。available = 空き、booked = 予約済み、past = 今日の始まった枠 */
export type SlotStatus = "available" | "booked" | "past";

/**
 * その日を受け付けない理由。受付中なら null。
 * past = 過去の日、out_of_range = 予約できる期間より先、regular_holiday = 定休日、holiday = 臨時休業日
 */
export type ClosedReason =
  "past" | "out_of_range" | "regular_holiday" | "holiday";

/** 1時間の枠。hour 12 = 12:00〜13:00 */
export type CalendarSlot = {
  hour: number;
  status: SlotStatus;
};

/** 1日分 */
export type CalendarDay = {
  /** "2026-10-06" */
  date: string;
  closed_reason: ClosedReason | null;
  /** 受付中の日だけ、営業時間の1時間ごと（時の順）。受付外の日は []（予約の有無も見せない） */
  slots: CalendarSlot[];
};

/** GET /api/calendar の返事 */
export type CalendarResponse = {
  meta: {
    /** サーバー（日本時間）の「今日」 */
    today: string;
    /** 予約できる最終日（この日を含む）。週送りの上限に使う（B13。フロントでは計算しない） */
    bookable_until: string;
  };
  /** from〜to の日ごと（日付の順） */
  data: CalendarDay[];
};
