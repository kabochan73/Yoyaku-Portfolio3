/*
 * 施設情報の型。バックエンドの FacilityResource（backend/app/Http/Resources/FacilityResource.php）と同じ形。
 * GET /api/facility の data の中身（docs/03）。
 */

/** 予約のルール。フロントはこれを使い、営業時間などを自分では持たない（D1） */
export type BookingRules = {
  /** 営業開始の時（例: 10） */
  open_hour: number;
  /** 営業終了の時（例: 22。最後の枠は 21時台） */
  close_hour: number;
  /** 1回の予約の最短の時間数（例: 2） */
  min_hours: number;
  /** 1回の予約の最長の時間数（例: 4） */
  max_hours: number;
  /** 何か月先まで予約できるか（例: 1） */
  booking_window_months: number;
};

export type Facility = {
  name: string;
  phone: string;
  address: string;
  email: string;
  rules: BookingRules;
  /** 1時間あたりの単価（円）。見積もりの表示に使う。確定の金額はサーバーが計算する（D8） */
  prices: { weekday: number; weekend: number };
  /** 定休日の曜日（0 = 日曜 … 6 = 土曜。小さい順）。定休日なしなら [] */
  regular_holidays: number[];
};
