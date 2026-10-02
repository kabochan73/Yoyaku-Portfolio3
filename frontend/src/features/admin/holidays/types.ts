/*
 * 臨時休業日の型。バックエンドの HolidayResource（docs/03）と同じ形。
 */
export type Holiday = {
  id: number;
  /** "2026-10-10" */
  date: string;
  /** 休業の理由（任意） */
  reason: string | null;
};

/** 臨時休業日の登録（POST /api/admin/holidays） */
export type CreateHolidayInput = {
  date: string;
  reason: string | null;
  /** その日の予約をキャンセルしてよいか（管理者が確認したら true で送り直す） */
  cancel_reservations: boolean;
};
