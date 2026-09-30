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
 * 表示用の書式（2026年10月6日（火） など）は lib/format.ts に分ける（手順5以降）。
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
