import type { BookingRules } from "@/features/facility/types";
import type { GridSlotStatus } from "./types";

/*
 * カレンダーで枠を選ぶルール（docs/05 の「枠選択のロジックを純粋関数にする」、docs/08 の 3.2〜3.4）。
 *
 * 選び方: 開始の枠を押し、次に終了の枠を押す。例: 12時の枠 → 13時の枠 を押すと 12:00〜14:00（2時間）。
 *
 * R1 は会員用（WeeklyCalendar）と管理者用（AdminCalendar）の両方に、ほぼ同じ判定（isValidEnd・handleSlotClick）が
 * コピーされていた。R2 はここに1つだけ置き、どちらのカレンダーからも使う（管理者用は手順7）。
 *
 * React を使わない「入力 → 出力」だけの関数にしているので、画面を作らずに Jest で境界値を直接確かめられる。
 * 枠の状態は引数の getStatus で毎回受け取る。60秒ごとの取り直しで枠の状態が変わっても、
 * 判定は常に最新の状態で行われ、矛盾しない（docs/08 の 3.4。選択中に埋まったときの特別な処理はしない）。
 */

/** 選択の状態 */
export type Selection =
  /** 何も選んでいない */
  | { kind: "idle" }
  /** 開始の枠だけを選んだ */
  | { kind: "start"; date: string; hour: number }
  /** 開始と終了を選び終わった。endHour は終了の時刻（12時と13時の枠を選んだら 14） */
  | { kind: "complete"; date: string; startHour: number; endHour: number };

/** 枠の場所。hour 12 = 12:00〜13:00 の枠 */
export type SlotRef = { date: string; hour: number };

/**
 * 枠の状態を返す関数。枠が無いとき（受付外の日・営業時間の外）は null。
 * カレンダーの部品が、表示中のデータから作って渡す。
 * 選べるのは available の枠だけ（booked・past・closed・null は選べない）。
 */
export type GetSlotStatus = (
  date: string,
  hour: number,
) => GridSlotStatus | null;

/** 選べる長さのルール（施設情報の rules。useFacility() から渡す。D1） */
export type LengthRules = Pick<BookingRules, "min_hours" | "max_hours">;

/** 何も選んでいない状態 */
export const IDLE: Selection = { kind: "idle" };

/**
 * 枠を押したときの、次の選択の状態（docs/08 の 3.2）。
 *
 * | 今の状態       | 押した枠                         | 次の状態                         |
 * |----------------|----------------------------------|----------------------------------|
 * | 未選択         | 空き                             | その枠を開始に選ぶ               |
 * | 開始を選択中   | 同じ枠                           | 未選択に戻す（R1 は何も起きなかった） |
 * | 開始を選択中   | 終了の候補（canBeEnd）           | 選び終わり                       |
 * | 開始を選択中   | 候補ではない空き（別の日も含む） | そこを開始に選び直す             |
 * | 開始を選択中   | 予約済み・過去                   | 未選択に戻す                     |
 * | 選び終わり     | （未選択と同じ）                 |                                  |
 */
export function selectSlot(
  current: Selection,
  clicked: SlotRef,
  getStatus: GetSlotStatus,
  rules: LengthRules,
): Selection {
  if (current.kind === "start") {
    // 同じ枠をもう一度押したら、選択をやめる
    if (current.date === clicked.date && current.hour === clicked.hour) {
      return IDLE;
    }

    if (canBeEnd(current, clicked, getStatus, rules)) {
      return {
        kind: "complete",
        date: current.date,
        startHour: current.hour,
        // 押したのは最後の枠なので、終了の時刻はその1時間後
        endHour: clicked.hour + 1,
      };
    }
  }

  // 未選択・選び終わりのとき、または候補ではない枠を押したとき:
  // 空きなら、そこを開始に選ぶ（選び直す）。予約済み・過去なら、選択をやめる
  if (getStatus(clicked.date, clicked.hour) === "available") {
    return { kind: "start", date: clicked.date, hour: clicked.hour };
  }
  return IDLE;
}

/**
 * その枠を終了に選べるか（開始を選択中のときだけ true になりうる）。
 *
 * 条件:
 * 1. 開始と同じ日
 * 2. 開始の枠から数えて min_hours〜max_hours 枠目（例: 2〜4枠目。1枠目 = 開始の枠そのもの）
 * 3. 開始から終了までの枠が、すべて空き
 *
 * 例: 12時を開始に選んだ（2〜4時間）→ 13・14・15時の枠が候補。12時（1枠目）と 16時（5枠目）は候補外。
 * 営業時間の外には枠が無い（getStatus が null）ので、21時を開始にすると候補は無い。
 */
export function canBeEnd(
  current: Selection,
  target: SlotRef,
  getStatus: GetSlotStatus,
  rules: LengthRules,
): boolean {
  if (current.kind !== "start" || current.date !== target.date) {
    return false;
  }

  // 開始の枠から数えて何枠目か（開始の枠 = 1）
  const slots = target.hour - current.hour + 1;
  if (slots < rules.min_hours || slots > rules.max_hours) {
    return false;
  }

  for (let hour = current.hour; hour <= target.hour; hour++) {
    if (getStatus(current.date, hour) !== "available") {
      return false;
    }
  }
  return true;
}

/**
 * 開始を選択中のとき、終了の候補が1つでもあるか。
 * 1つも無ければ、案内に「この時間からは続けて空いていません」と出す（docs/08 の 3.3・3.4）。
 */
export function hasEndCandidate(
  current: Selection,
  getStatus: GetSlotStatus,
  rules: LengthRules,
): boolean {
  if (current.kind !== "start") {
    return false;
  }

  for (let slots = rules.min_hours; slots <= rules.max_hours; slots++) {
    const target = { date: current.date, hour: current.hour + slots - 1 };
    if (canBeEnd(current, target, getStatus, rules)) {
      return true;
    }
  }
  return false;
}
