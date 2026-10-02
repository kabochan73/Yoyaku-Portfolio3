import { formatHourRange, formatMonthDayJa } from "@/lib/format";
import type { GridSlotStatus } from "../types";

/*
 * カレンダーの1つの枠（docs/08 の 3.2）。
 *
 * | 状態               | PC     | スマホ      | 押せるか |
 * |--------------------|--------|-------------|----------|
 * | 空き               | 空き   | 空          | ○        |
 * | 開始に選択中       | 開始   | 空（強調）  | ○（押すと解除） |
 * | 選び終わった範囲   | 選択中 | 空（強調）  | ○        |
 * | 終了の候補         | 空き（強調） | 空（強調） | ○   |
 * | 予約済み           | 予約済 | ✕           | ×        |
 * | 過去・受付外の日   | －     | －          | ×        |
 *
 * 枠は <button> にする。押せない枠は disabled（キーボードでも選べない）。
 * R1 は <td> に onClick を付けていたので、キーボードで操作できず、画面読み上げにもボタンと伝わらなかった。
 *
 * 状態を持たない部品なので "use client" を付けない（使う側の BookingCalendar が Client Component）。
 */

/** 選択との関係（どれにも当たらなければ "none"） */
export type SlotSelectionState = "none" | "start" | "selected" | "candidate";

type Props = {
  date: string;
  hour: number;
  /** 枠の状態。受付外の日など、枠が無いときは null */
  status: GridSlotStatus | null;
  selectionState: SlotSelectionState;
  onClick: () => void;
  /** 予約済みの枠に出す名前（管理者用。予約者名）。無ければ「予約済」 */
  bookedLabel?: string;
  /** 予約済みの枠を押せるようにするか（管理者用。予約の詳細を開く） */
  bookedClickable?: boolean;
};

/**
 * スマホでは予約者名を先頭2文字 +「…」にする（docs/08 の 9）。
 * 電話予約の印「☎」は残し、名前の部分だけを縮める。例: "☎ 電話 佐藤" → "☎電話…"、"山田太郎" → "山田…"
 */
function shortName(label: string): string {
  const isPhone = label.startsWith("☎");
  const name = (isPhone ? label.slice(1) : label).trim();
  const short = name.length > 2 ? `${name.slice(0, 2)}…` : name;
  return isPhone ? `☎${short}` : short;
}

/** 見た目と文言 */
function appearance(
  status: GridSlotStatus | null,
  selectionState: SlotSelectionState,
  bookedLabel: string | undefined,
): { label: string; mobileLabel: string; className: string } {
  if (status === "booked") {
    return {
      label: bookedLabel ?? "予約済",
      mobileLabel: bookedLabel ? shortName(bookedLabel) : "✕",
      className: "bg-red-50 text-red-400",
    };
  }
  if (status !== "available") {
    // 過去の枠（past）・受付外の日（closed・null）
    return {
      label: "－",
      mobileLabel: "－",
      className: "bg-zinc-100 text-zinc-400",
    };
  }

  switch (selectionState) {
    case "start":
      return {
        label: "開始",
        mobileLabel: "空",
        className: "bg-green-600 text-white",
      };
    case "selected":
      return {
        label: "選択中",
        mobileLabel: "空",
        className: "bg-green-600 text-white",
      };
    case "candidate":
      return {
        label: "空き",
        mobileLabel: "空",
        className:
          "bg-green-100 text-green-700 ring-1 ring-green-400 hover:bg-green-200",
      };
    case "none":
      return {
        label: "空き",
        mobileLabel: "空",
        className: "bg-white text-green-700 hover:bg-green-50",
      };
  }
}

export function SlotCell({
  date,
  hour,
  status,
  selectionState,
  onClick,
  bookedLabel,
  bookedClickable = false,
}: Props) {
  const { label, mobileLabel, className } = appearance(
    status,
    selectionState,
    bookedLabel,
  );
  const clickable =
    status === "available" || (status === "booked" && bookedClickable);

  // 画面読み上げ用の名前。例: "10月6日（火）12:00 〜 13:00 空き"、管理者用は "… 予約済み 山田太郎"
  const statusText =
    status === "available"
      ? "空き"
      : status === "booked"
        ? `予約済み${bookedLabel ? ` ${bookedLabel}` : ""}`
        : "受付外";
  const accessibleName = `${formatMonthDayJa(date)}${formatHourRange(hour, hour + 1)} ${statusText}`;

  return (
    <td className="px-1 py-1.5 text-center sm:px-1.5">
      <button
        type="button"
        disabled={!clickable}
        onClick={onClick}
        aria-label={accessibleName}
        // 開始・選んだ範囲の枠は「押されている」状態として伝える
        aria-pressed={
          clickable
            ? selectionState === "start" || selectionState === "selected"
            : undefined
        }
        className={[
          "w-full rounded-md px-1 py-1 text-xs font-semibold transition sm:px-2",
          "focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none",
          clickable ? "cursor-pointer" : "cursor-default",
          className,
        ].join(" ")}
      >
        <span className="sm:hidden">{mobileLabel}</span>
        <span className="hidden sm:inline">{label}</span>
      </button>
    </td>
  );
}
