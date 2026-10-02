/*
 * 画面に出す表記をそろえる関数（docs/08 の 1.4）。
 *
 * R1 は日付・時刻の書き方を画面ごとにコピーしていて、画面によって表記がばらばらだった。
 * 表記はここに集め、どの画面もここの関数を使う。
 * 日付の関数（formatDateJa・formatWeekRange）は、使う手順で足す。
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
 * 曜日の番号を「月曜日」の形にする。
 * 例: formatDayOfWeek(1) → "月曜日"
 */
export function formatDayOfWeek(dayOfWeek: number): string {
  return `${DAY_OF_WEEK_NAMES[dayOfWeek] ?? "?"}曜日`;
}
