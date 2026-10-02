import { api } from "@/lib/api-client";
import type { CalendarResponse } from "./types";

/*
 * カレンダーの API をブラウザから呼ぶ関数（docs/05 の「features/<機能>/api.ts」）。
 */

/**
 * from〜to（両端を含む。最大14日）の空き状況を取る（GET /api/calendar）。
 *
 * サーバーは ETag を付けて返し、中身が前回と同じなら本文なしの 304 を返す（docs/03）。
 * 304 のときはブラウザが前回の本文を使うので、ここからは普通の 200 に見える（このコードは何もしなくてよい）。
 */
export async function fetchCalendar(
  from: string,
  to: string,
): Promise<CalendarResponse> {
  const response = await api.get<CalendarResponse>("/calendar", {
    params: { from, to },
  });
  return response.data;
}
