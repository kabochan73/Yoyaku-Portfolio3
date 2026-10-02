import { Button } from "@/components/ui/Button";

/*
 * 週送り（docs/08 の 3.5）。「← 前の週」「10/5 〜 10/11」「次の週 →」。
 *
 * 進めない・戻れないときは、ボタンを本当に押せなくする（disabled）。
 * R1 は aria-disabled と見た目を薄くしただけで、実際には押せた（押した後の判定で止めていた）。
 *
 * どこまで進めるかは使う側が決める（BookingCalendar。B13 の bookable_until）。
 * 会員用・管理者用のカレンダーで共通（docs/08 の 10）。
 */

type Props = {
  /** 表示中の週。例: "10/5 〜 10/11" */
  weekLabel: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function WeekNavigator({
  weekLabel,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}: Props) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={!canGoPrev}
        onClick={onPrev}
      >
        ← 前の週
      </Button>
      {/* 週が変わったことを画面読み上げにも伝える */}
      <p
        aria-live="polite"
        className="text-lg font-medium text-zinc-800 sm:text-xl"
      >
        {weekLabel}
      </p>
      <Button
        variant="secondary"
        size="sm"
        disabled={!canGoNext}
        onClick={onNext}
      >
        次の週 →
      </Button>
    </div>
  );
}
