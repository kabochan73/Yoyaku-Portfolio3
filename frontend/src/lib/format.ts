import { addDays, dayOfWeek } from "./date";

/*
 * 画面に出す表記をそろえる関数（docs/08 の 1.4）。
 *
 * R1 は日付・時刻の書き方を画面ごとにコピーしていて、画面によって表記がばらばらだった。
 * 表記はここに集め、どの画面もここの関数を使う。
 *
 * 計算（日付を進めるなど）は lib/date.ts。ここは「見せ方」だけを扱う。
 */

/**
 * 時（整数）を時刻の表記にする。
 * 例: formatHour(9) → "9:00"、formatHour(14) → "14:00"
 */
export function formatHour(hour: number): string {
  return `${hour}:00`;
}

/**
 * 開始と終了の時を、時間帯の表記にする（docs/08 の 1.4）。
 * 例: formatHourRange(12, 14) → "12:00 〜 14:00"
 */
export function formatHourRange(startHour: number, endHour: number): string {
  return `${formatHour(startHour)} 〜 ${formatHour(endHour)}`;
}

/**
 * 金額（円）を表示の形にする（docs/08 の 1.4）。
 * 例: formatYen(8000) → "¥8,000"
 */
export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

/** 曜日の名前。Date#getDay() やバックエンドの day_of_week と同じく、0 = 日曜 … 6 = 土曜 */
const DAY_OF_WEEK_NAMES = ["日", "月", "火", "水", "木", "金", "土"] as const;

/**
 * 日付の曜日の1文字。カレンダーの見出しに使う。
 * 例: formatDayOfWeekShort("2026-10-06") → "火"
 */
export function formatDayOfWeekShort(date: string): string {
  return DAY_OF_WEEK_NAMES[dayOfWeek(date)] ?? "?";
}

/** "2026-10-06" を [2026, 10, 6] に分ける（このファイルの中だけで使う） */
function splitDate(date: string): [number, number, number] {
  const [year = 0, month = 0, day = 0] = date.split("-").map(Number);
  return [year, month, day];
}

/**
 * 日付（長い形。docs/08 の 1.4）。
 * 例: formatDateJa("2026-10-06") → "2026年10月6日（火）"
 */
export function formatDateJa(date: string): string {
  const [year, month, day] = splitDate(date);
  return `${year}年${month}月${day}日（${formatDayOfWeekShort(date)}）`;
}

/**
 * 日付（年なし）。カレンダーの枠の読み上げ用のラベルに使う。
 * 例: formatMonthDayJa("2026-10-06") → "10月6日（火）"
 */
export function formatMonthDayJa(date: string): string {
  const [, month, day] = splitDate(date);
  return `${month}月${day}日（${formatDayOfWeekShort(date)}）`;
}

/**
 * 週の範囲（短い形。docs/08 の 1.4）。月曜から日曜までの7日間。
 * 例: formatWeekRange("2026-10-05") → "10/5 〜 10/11"
 *
 * @param weekStart その週の月曜日
 */
export function formatWeekRange(weekStart: string): string {
  const [, startMonth, startDay] = splitDate(weekStart);
  const [, endMonth, endDay] = splitDate(addDays(weekStart, 6));
  return `${startMonth}/${startDay} 〜 ${endMonth}/${endDay}`;
}

/**
 * 曜日の番号を「月曜日」の形にする。
 * 例: formatDayOfWeek(1) → "月曜日"
 */
export function formatDayOfWeek(dayOfWeek: number): string {
  return `${DAY_OF_WEEK_NAMES[dayOfWeek] ?? "?"}曜日`;
}
