import type { Facility } from "@/features/facility/types";
import { api } from "@/lib/api-client";

/*
 * 施設の設定（料金・定休日）の API（docs/03 の PUT /admin/prices・PUT /admin/regular-holidays）。
 * どちらも、更新した後の施設情報を /facility と同じ形で返す。
 */

/** 料金を変える。失敗: 422（0以上の整数でない など） */
export async function updatePrices(input: {
  weekday: number;
  weekend: number;
}): Promise<Facility> {
  const response = await api.put<{ data: Facility }>("/admin/prices", input);
  return response.data.data;
}

/** 定休日の曜日を変える（0 = 日曜 … 6 = 土曜。空なら定休日なし） */
export async function updateRegularHolidays(days: number[]): Promise<Facility> {
  const response = await api.put<{ data: Facility }>(
    "/admin/regular-holidays",
    {
      days,
    },
  );
  return response.data.data;
}
