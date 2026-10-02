import { estimatePrice } from "@/features/facility/price";

/*
 * 料金の見積もり（estimatePrice）のテスト。サーバーの PriceTable と同じ計算であること。
 */

const PRICES = { weekday: 4000, weekend: 5000 };

it("平日は平日の単価 × 時間数", () => {
  expect(estimatePrice("2026-10-06", 2, PRICES)).toBe(8000); // 火曜
  expect(estimatePrice("2026-10-09", 4, PRICES)).toBe(16000); // 金曜
});

it("土曜・日曜は土日の単価 × 時間数", () => {
  expect(estimatePrice("2026-10-10", 2, PRICES)).toBe(10000); // 土曜
  expect(estimatePrice("2026-10-11", 3, PRICES)).toBe(15000); // 日曜
});
