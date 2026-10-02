import { formatDateJa, formatHour, formatHourRange } from "@/lib/format";
import {
  hasEndCandidate,
  type GetSlotStatus,
  type LengthRules,
  type Selection,
} from "../selection";

/*
 * グリッドの上に出す、1行の案内（docs/08 の 3.3）。
 *
 * R1 は操作の説明が見出しの「クリックで予約！」だけで、「2〜4時間」のルールは施設情報を読まないと分からなかった。
 * 今の選択の状態に合わせて、次に何をすればよいかを出す。{min}・{max} は施設情報の rules から入れる（D1）。
 *
 * aria-live="polite": 文言が変わったら、画面読み上げが手の空いたときに読み上げる。
 * 状態を持たない部品なので "use client" を付けない。
 */

type Props = {
  selection: Selection;
  getStatus: GetSlotStatus;
  rules: LengthRules;
};

/** 状態ごとの文言 */
export function selectionHintText(
  selection: Selection,
  getStatus: GetSlotStatus,
  rules: LengthRules,
): string {
  const { min_hours: min, max_hours: max } = rules;

  switch (selection.kind) {
    case "idle":
      return `開始時刻の枠を選んでください（${min}〜${max}時間）`;
    case "start":
      return hasEndCandidate(selection, getStatus, rules)
        ? `終了時刻の枠を選んでください。${formatHour(selection.hour)} から${min}〜${max}時間まで選べます`
        : `この時間からは${min}時間以上続けて空いていません。別の枠を選んでください`;
    case "complete":
      // 手順6では、選び終わったら確認ダイアログを開く。それまでは選んだ内容をここに出す
      return `${formatDateJa(selection.date)} ${formatHourRange(selection.startHour, selection.endHour)}（${
        selection.endHour - selection.startHour
      }時間）を選択中`;
  }
}

export function SelectionHint({ selection, getStatus, rules }: Props) {
  return (
    <p aria-live="polite" className="mb-3 text-sm text-zinc-700">
      {selectionHintText(selection, getStatus, rules)}
    </p>
  );
}
