/*
 * 日付の計算（docs/05 の「日付の扱い」）。
 *
 * 方針:
 * - 日付は "YYYY-MM-DD" の文字列で扱う。JavaScript の Date は端末のタイムゾーンで
 *   日付がずれるので、Date を使う処理はこのファイルに閉じ込める。
 * - 「今日」は端末のタイムゾーンではなく、日本時間で求める。
 *   R1 は new Date() をそのまま使っていたので、海外や時刻設定のずれた端末では
 *   週の表示や「今日」の印がずれる作りだった（フロント版の B1）。
 *
 * 表示用の書式（2026年10月6日（火） など）は lib/format.ts に分ける。
 */

/**
 * 日付を "YYYY-MM-DD" にする書式。
 *
 * "sv-SE"（スウェーデン語）を使うのは、この言語の日付の既定の形がちょうど "2026-10-06" だから。
 * 日本語（"ja-JP"）だと "2026/10/06" になってしまう。
 * timeZone に日本を指定しているので、端末がどこにあっても日本の日付で書き出される。
 */
const tokyoDateFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * 日本時間での「今日」を "YYYY-MM-DD" で返す。
 *
 * @param now 基準にする時刻。省略すると現在時刻。テストでは時刻を渡して結果を確かめられる。
 * @example
 * // 端末がロサンゼルス（10/5 16:00）でも、日本時間は 10/6 08:00 なので
 * todayInTokyo(new Date("2026-10-05T23:00:00Z")); // → "2026-10-06"
 */
export function todayInTokyo(now: Date = new Date()): string {
  return tokyoDateFormat.format(now);
}

/**
 * "YYYY-MM-DD" を、その日の UTC 0時の Date にする（このファイルの中だけで使う）。
 *
 * 日付の足し引きを UTC で行うのは、端末のタイムゾーンや夏時間に左右されないため。
 * 例: 夏時間のある地域では、端末の時刻で「1日 = 24時間」を足すと、切り替わりの日に日付がずれることがある。
 * UTC には夏時間が無いので、日付だけを正しく進められる。
 */
function parseDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

/** parseDate で作った Date を "YYYY-MM-DD" に戻す（このファイルの中だけで使う） */
function toDateString(date: Date): string {
  // toISOString() は UTC で "2026-10-06T00:00:00.000Z" の形。先頭の10文字が日付
  return date.toISOString().slice(0, 10);
}

/**
 * 日付に日数を足す（マイナスなら引く）。月末・年末も正しくまたぐ。
 *
 * @example
 * addDays("2026-10-06", 7);  // → "2026-10-13"
 * addDays("2026-10-31", 1);  // → "2026-11-01"
 * addDays("2026-10-05", -1); // → "2026-10-04"
 */
export function addDays(date: string, days: number): string {
  const result = parseDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return toDateString(result);
}

/**
 * その日を含む週の月曜日。カレンダーは月曜始まり（月〜日）で1週間を表示する。
 * 日曜日は、その前の月曜日（6日前）の週に入る。
 *
 * @example
 * mondayOf("2026-10-08"); // 木曜 → "2026-10-05"
 * mondayOf("2026-10-05"); // 月曜 → "2026-10-05"（そのまま）
 * mondayOf("2026-10-11"); // 日曜 → "2026-10-05"
 */
export function mondayOf(date: string): string {
  // dayOfWeek(): 0 = 日曜, 1 = 月曜 … 6 = 土曜。月曜から何日たっているか（月曜 0 … 日曜 6）に直す
  const daysSinceMonday = (dayOfWeek(date) + 6) % 7;
  return addDays(date, -daysSinceMonday);
}

/**
 * 曜日の番号（0 = 日曜 … 6 = 土曜）。端末のタイムゾーンに左右されない。
 *
 * @example
 * dayOfWeek("2026-10-06"); // 火曜 → 2
 */
export function dayOfWeek(date: string): number {
  return parseDate(date).getUTCDay();
}
