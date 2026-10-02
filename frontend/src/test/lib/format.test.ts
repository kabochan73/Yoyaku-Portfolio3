import { formatHour, formatHourRange } from "@/lib/format";

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
