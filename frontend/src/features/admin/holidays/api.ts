import { api } from "@/lib/api-client";
import type { CreateHolidayInput, Holiday } from "./types";

/*
 * 臨時休業日の API（docs/03 の /admin/holidays）。
 */

/** 今日以降の臨時休業日（日付順） */
export async function fetchHolidays(): Promise<Holiday[]> {
  const response = await api.get<{ data: Holiday[] }>("/admin/holidays");
  return response.data.data;
}

/**
 * 臨時休業日を登録する。
 * 失敗: 409 holiday_has_reservations（予約がある。件数は body の reservation_count）/
 *       409 holiday_already_exists / 422（過去の日 など）
 */
export async function createHoliday(
  input: CreateHolidayInput,
): Promise<Holiday> {
  const response = await api.post<{ data: Holiday }>("/admin/holidays", input);
  return response.data.data;
}

/** 臨時休業日を解除する（成功は 204） */
export async function deleteHoliday(id: number): Promise<void> {
  await api.delete(`/admin/holidays/${id}`);
}
