import { dayOfWeek } from "@/lib/date";
import type { Facility } from "./types";

/*
 * 料金の見積もり（docs/05 の「ブラウザ側」、D8）。
 *
 * 確認ダイアログに出す金額を、施設情報の単価から計算する。
 * 確定の金額はサーバーが予約のときに計算して保存する（CreateReservation・PriceTable）。
 * 完了のメッセージとメールには、サーバーが返した金額を使う。ここで計算した金額は予約に使わない。
 *
 * 計算のルールはサーバーの PriceTable と同じ: その日の単価 × 時間数。土日は土日の単価、祝日は平日の単価（docs/01）。
 */

/**
 * 見積もりの金額（円）。
 *
 * @example
 * estimatePrice("2026-10-06", 2, { weekday: 4000, weekend: 5000 }); // 火曜 → 8000
 * estimatePrice("2026-10-10", 2, { weekday: 4000, weekend: 5000 }); // 土曜 → 10000
 */
export function estimatePrice(
  date: string,
  hours: number,
  prices: Facility["prices"],
): number {
  const day = dayOfWeek(date);
  // 0 = 日曜、6 = 土曜
  const isWeekend = day === 0 || day === 6;
  return (isWeekend ? prices.weekend : prices.weekday) * hours;
}
