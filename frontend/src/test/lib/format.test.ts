import {
  formatDayOfWeek,
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
