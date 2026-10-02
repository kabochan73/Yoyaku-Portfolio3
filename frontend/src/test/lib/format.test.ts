import {
  formatDateJa,
  formatDayOfWeek,
  formatDayOfWeekShort,
  formatMonthDayJa,
  formatWeekRange,
  formatHour,
  formatHourRange,
  formatYen,
} from "@/lib/format";

/*
 * 表記をそろえる関数（lib/format.ts）のテスト。
 */

it("formatHour: 時を「時:00」にする（1桁の時は0を付けない）", () => {
  expect(formatHour(9)).toBe("9:00");
  expect(formatHour(10)).toBe("10:00");
  expect(formatHour(22)).toBe("22:00");
});

it("formatHourRange: 開始と終了を「〜」でつなぐ", () => {
  expect(formatHourRange(12, 14)).toBe("12:00 〜 14:00");
  expect(formatHourRange(10, 22)).toBe("10:00 〜 22:00");
});

it("formatYen: 円記号と3桁ごとのカンマを付ける", () => {
  expect(formatYen(800)).toBe("¥800");
  expect(formatYen(8000)).toBe("¥8,000");
  expect(formatYen(12000)).toBe("¥12,000");
});

it("formatDayOfWeek: 0 = 日曜 … 6 = 土曜", () => {
  expect(formatDayOfWeek(0)).toBe("日曜日");
  expect(formatDayOfWeek(1)).toBe("月曜日");
  expect(formatDayOfWeek(6)).toBe("土曜日");
});

it("formatDateJa: 年月日と曜日（端末のタイムゾーンに左右されない）", () => {
  expect(formatDateJa("2026-10-06")).toBe("2026年10月6日（火）");
  expect(formatDateJa("2027-01-01")).toBe("2027年1月1日（金）");
});

it("formatMonthDayJa・formatDayOfWeekShort: 年なしの日付と、曜日の1文字", () => {
  expect(formatMonthDayJa("2026-10-06")).toBe("10月6日（火）");
  expect(formatDayOfWeekShort("2026-10-11")).toBe("日");
});

it("formatWeekRange: 月曜から日曜まで。月をまたぐ週も", () => {
  expect(formatWeekRange("2026-10-05")).toBe("10/5 〜 10/11");
  expect(formatWeekRange("2026-10-26")).toBe("10/26 〜 11/1");
});
