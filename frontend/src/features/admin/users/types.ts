/*
 * 会員検索の型。バックエンドの GET /api/admin/users（AdminUserResource。docs/03）と同じ形。
 */
export type AdminUser = {
  id: number;
  name: string;
  email: string;
  /** 確定済みの予約の件数（キャンセル済みは数えない） */
  confirmed_reservations_count: number;
};

export type UserSearchResponse = {
  data: AdminUser[];
  /** 一度に返す最大の人数（20）。結果がちょうどこの数なら、続きがあるかもしれない */
  meta: { limit: number };
};
