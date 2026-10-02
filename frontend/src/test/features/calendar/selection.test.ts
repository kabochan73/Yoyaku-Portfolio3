import {
  canBeEnd,
  hasEndCandidate,
  IDLE,
  selectSlot,
  type GetSlotStatus,
  type Selection,
} from "@/features/calendar/selection";
import type { SlotStatus } from "@/features/calendar/types";

/*
 * 枠を選ぶルール（selection.ts）のテスト（docs/06 の「必ず書くテスト」）。
 *
 * 営業時間 10〜21時の枠、2〜4時間。10/6 と 10/7 は受付中で、10/8 は受付外（枠なし）。
 * 10/6 の 15時の枠だけ予約済みにしておく。
 */

const RULES = { min_hours: 2, max_hours: 4 };

const BOOKED: Record<string, number[]> = { "2026-10-06": [15] };
const OPEN_DAYS = ["2026-10-06", "2026-10-07"];

const getStatus: GetSlotStatus = (date, hour): SlotStatus | null => {
  // 受付外の日・営業時間の外は、枠そのものが無い
  if (!OPEN_DAYS.includes(date) || hour < 10 || hour > 21) {
    return null;
  }
  return BOOKED[date]?.includes(hour) ? "booked" : "available";
};

/** 10/6 の hour 時を開始に選んだ状態 */
function startAt(hour: number, date = "2026-10-06"): Selection {
  return { kind: "start", date, hour };
}

/** 開始を選んだ状態で、終了の候補になる時の一覧 */
function endCandidates(current: Selection, date = "2026-10-06"): number[] {
  const hours = [];
  for (let hour = 10; hour <= 21; hour++) {
    if (canBeEnd(current, { date, hour }, getStatus, RULES)) {
      hours.push(hour);
    }
  }
  return hours;
}

describe("canBeEnd（終了に選べる枠）", () => {
  it("開始から数えて2〜4枠目が候補。1枠目（開始そのもの）と5枠目は候補外", () => {
    // 10時を開始 → 11（2枠目）・12（3枠目）・13（4枠目）
    expect(endCandidates(startAt(10))).toEqual([11, 12, 13]);
  });

  it("間に予約済みの枠があると、その先は候補外", () => {
    // 13時を開始。15時が予約済みなので、14時（2枠目）だけ
    expect(endCandidates(startAt(13))).toEqual([14]);
  });

  it("開始より前の枠は候補外", () => {
    expect(endCandidates(startAt(12))).not.toContain(11);
  });

  it("別の日の枠は候補外", () => {
    expect(endCandidates(startAt(10), "2026-10-07")).toEqual([]);
  });

  it("営業時間の終わり: 21時を開始にすると候補は無い。20時なら21時だけ", () => {
    expect(endCandidates(startAt(21))).toEqual([]);
    expect(endCandidates(startAt(20))).toEqual([21]);
  });

  it("開始を選んでいなければ、どの枠も候補ではない", () => {
    expect(
      canBeEnd(IDLE, { date: "2026-10-06", hour: 11 }, getStatus, RULES),
    ).toBe(false);
  });

  it("長さのルールは引数に従う（直書きしない）", () => {
    const oneToTwo = { min_hours: 1, max_hours: 2 };
    expect(
      canBeEnd(
        startAt(10),
        { date: "2026-10-06", hour: 10 },
        getStatus,
        oneToTwo,
      ),
    ).toBe(true);
    expect(
      canBeEnd(
        startAt(10),
        { date: "2026-10-06", hour: 12 },
        getStatus,
        oneToTwo,
      ),
    ).toBe(false);
  });
});

describe("selectSlot（枠を押したときの次の状態）", () => {
  /** 10/6 の hour 時の枠を押す */
  const click = (current: Selection, hour: number, date = "2026-10-06") =>
    selectSlot(current, { date, hour }, getStatus, RULES);

  it("未選択で空きを押すと、そこを開始に選ぶ", () => {
    expect(click(IDLE, 12)).toEqual(startAt(12));
  });

  it("未選択で予約済みを押しても、何も選ばない", () => {
    expect(click(IDLE, 15)).toEqual(IDLE);
  });

  it("開始を選んだ後に終了の候補を押すと、選び終わる（終了は押した枠の1時間後）", () => {
    expect(click(startAt(12), 13)).toEqual({
      kind: "complete",
      date: "2026-10-06",
      startHour: 12,
      endHour: 14,
    });
    // 4時間ちょうど
    expect(click(startAt(10), 13)).toEqual({
      kind: "complete",
      date: "2026-10-06",
      startHour: 10,
      endHour: 14,
    });
  });

  it("同じ枠をもう一度押すと、選択をやめる（R1 では何も起きなかった）", () => {
    expect(click(startAt(12), 12)).toEqual(IDLE);
  });

  it("候補ではない空き（5枠目）を押すと、そこを開始に選び直す", () => {
    expect(click(startAt(10), 14)).toEqual(startAt(14));
  });

  it("別の日の空きを押すと、そこを開始に選び直す", () => {
    expect(click(startAt(10), 11, "2026-10-07")).toEqual(
      startAt(11, "2026-10-07"),
    );
  });

  it("開始を選んだ後に予約済みを押すと、選択をやめる", () => {
    expect(click(startAt(12), 15)).toEqual(IDLE);
  });

  it("選び終わった後に空きを押すと、新しく開始を選ぶ", () => {
    const complete: Selection = {
      kind: "complete",
      date: "2026-10-06",
      startHour: 10,
      endHour: 12,
    };
    expect(click(complete, 18)).toEqual(startAt(18));
  });
});

describe("hasEndCandidate（終了の候補が1つでもあるか）", () => {
  it("候補があれば true", () => {
    expect(hasEndCandidate(startAt(10), getStatus, RULES)).toBe(true);
  });

  it("次の枠が予約済み・営業時間の終わりなら false", () => {
    // 14時を開始 → 次の15時が予約済み
    expect(hasEndCandidate(startAt(14), getStatus, RULES)).toBe(false);
    expect(hasEndCandidate(startAt(21), getStatus, RULES)).toBe(false);
  });

  it("開始を選んでいなければ false", () => {
    expect(hasEndCandidate(IDLE, getStatus, RULES)).toBe(false);
  });
});
