import { selectionHintText } from "@/features/calendar/components/SelectionHint";
import { IDLE, type GetSlotStatus } from "@/features/calendar/selection";

/*
 * 選択中の案内（SelectionHint）の文言のテスト（docs/08 の 3.3）。
 * 10/6 の 10〜21時が空きで、15時だけ予約済み。
 */

const RULES = { min_hours: 2, max_hours: 4 };

const getStatus: GetSlotStatus = (date, hour) => {
  if (date !== "2026-10-06" || hour < 10 || hour > 21) {
    return null;
  }
  return hour === 15 ? "booked" : "available";
};

it("未選択: 開始を選ぶよう案内し、長さのルールを出す", () => {
  expect(selectionHintText(IDLE, getStatus, RULES)).toBe(
    "開始時刻の枠を選んでください（2〜4時間）",
  );
});

it("開始を選択中: 終了を選ぶよう案内する", () => {
  expect(
    selectionHintText(
      { kind: "start", date: "2026-10-06", hour: 12 },
      getStatus,
      RULES,
    ),
  ).toBe("終了時刻の枠を選んでください。12:00 から2〜4時間まで選べます");
});

it("開始を選択中で終了の候補が無い: 別の枠を選ぶよう案内する", () => {
  // 14時を開始 → 次の15時が予約済み
  expect(
    selectionHintText(
      { kind: "start", date: "2026-10-06", hour: 14 },
      getStatus,
      RULES,
    ),
  ).toBe("この時間からは2時間以上続けて空いていません。別の枠を選んでください");
});

it("選び終わり: 選んだ日付・時間・時間数を出す", () => {
  expect(
    selectionHintText(
      { kind: "complete", date: "2026-10-06", startHour: 12, endHour: 14 },
      getStatus,
      RULES,
    ),
  ).toBe("2026年10月6日（火） 12:00 〜 14:00（2時間）を選択中");
});

it("長さのルールが変われば、文言の数字も変わる（直書きしない）", () => {
  expect(
    selectionHintText(IDLE, getStatus, { min_hours: 1, max_hours: 3 }),
  ).toBe("開始時刻の枠を選んでください（1〜3時間）");
});
