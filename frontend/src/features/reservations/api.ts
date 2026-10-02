import { api } from "@/lib/api-client";
import type { CreateReservationInput, Reservation } from "./types";

/*
 * 予約の API をブラウザから呼ぶ関数（docs/05 の「features/<機能>/api.ts」）。
 * 失敗は ApiError になって投げられる（lib/api-client.ts）。
 */

/** 自分の今日以降の確定済みの予約（GET /api/user/reservations）。日付・開始時刻の順 */
export async function fetchMyReservations(): Promise<Reservation[]> {
  const response = await api.get<{ data: Reservation[] }>("/user/reservations");
  return response.data.data;
}

/**
 * 予約する（POST /api/reservations）。
 * 失敗: 422（ルール違反。項目エラー）/ 409 slot_taken・already_booked_that_day
 */
export async function createReservation(
  input: CreateReservationInput,
): Promise<Reservation> {
  const response = await api.post<{ data: Reservation }>(
    "/reservations",
    input,
  );
  return response.data.data;
}

/**
 * 自分の予約をキャンセルする（POST /api/reservations/{id}/cancel）。
 * 失敗: 409 reservation_not_cancellable（開始済み・キャンセル済み）/ 403（他人の予約）
 */
export async function cancelReservation(id: number): Promise<Reservation> {
  const response = await api.post<{ data: Reservation }>(
    `/reservations/${id}/cancel`,
  );
  return response.data.data;
}
