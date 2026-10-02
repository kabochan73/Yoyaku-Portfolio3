import { api } from "@/lib/api-client";
import type {
  AdminCalendarResponse,
  AdminReservation,
  CreatePhoneReservationInput,
} from "./types";

/*
 * 管理者用のカレンダー・電話予約・管理者のキャンセルの API（docs/03 の「管理者」）。
 * 管理者でなければ 403 になる（サーバーの can:admin）。
 */

/** from〜to（最大14日）の管理者用のカレンダー（GET /api/admin/calendar）。ETag / 304 は公開用と同じ */
export async function fetchAdminCalendar(
  from: string,
  to: string,
): Promise<AdminCalendarResponse> {
  const response = await api.get<AdminCalendarResponse>("/admin/calendar", {
    params: { from, to },
  });
  return response.data;
}

/**
 * 電話予約を登録する（POST /api/admin/reservations）。会員の予約と同じルール。
 * 失敗: 422（ルール違反・予約者名）/ 409 slot_taken
 */
export async function createPhoneReservation(
  input: CreatePhoneReservationInput,
): Promise<AdminReservation> {
  const response = await api.post<{ data: AdminReservation }>(
    "/admin/reservations",
    input,
  );
  return response.data.data;
}

/**
 * 予約をキャンセルする（POST /api/admin/reservations/{id}/cancel）。誰の予約でも。
 * 会員の予約なら「管理者によるキャンセル」のメールが届く。失敗: 409 reservation_not_cancellable
 */
export async function adminCancelReservation(
  id: number,
): Promise<AdminReservation> {
  const response = await api.post<{ data: AdminReservation }>(
    `/admin/reservations/${id}/cancel`,
  );
  return response.data.data;
}
