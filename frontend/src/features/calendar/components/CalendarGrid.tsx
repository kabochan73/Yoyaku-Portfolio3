import { Skeleton } from "@/components/ui/Skeleton";
import { addDays, dayOfWeek } from "@/lib/date";
import {
  formatDayOfWeekShort,
  formatHour,
  formatHourRange,
} from "@/lib/format";
import {
  canBeEnd,
  type GetSlotStatus,
  type LengthRules,
  type Selection,
} from "../selection";
import { SlotCell, type SlotSelectionState } from "./SlotCell";

/*
 * 週間カレンダーの表（docs/08 の 3）。縦が時刻、横が月曜〜日曜の7日。
 *
 * - 見出しの日付は週の月曜日から作るので、データが届く前から出せる。読み込み中は枠だけスケルトンにする（3.1）
 *   ただし週がまだ決まっていないとき（静的な HTML を作るとき。BookingCalendar の説明）は、見出しもスケルトンにする
 * - 週を切り替えている間は、前の週の枠を出したまま薄くする（dimmed。3.1）
 * - 時刻の行は営業時間のルールから作る（D1。R1 は HOURS = 10〜21 を直書き）
 * - スマホでは時刻の列を "10:00" だけにし、表の中だけ横にスクロールさせる（docs/08 の 9）
 *
 * 会員用（BookingCalendar）と管理者用（手順7）で共通。状態を持たない部品なので "use client" を付けない。
 */

type Props = {
  /** 表示する週の月曜日（"2026-10-05"）。まだ決まっていなければ null（見出しもスケルトンにする） */
  weekStart: string | null;
  /** 今日（日本時間）。見出しに印を付ける */
  today: string | null;
  /** 営業時間と、選べる長さのルール（施設情報の rules） */
  rules: LengthRules & { open_hour: number; close_hour: number };
  /** 枠の状態。データが届くまでは使わない */
  getStatus: GetSlotStatus;
  selection: Selection;
  /** 最初の読み込み中（枠をスケルトンにする） */
  loading: boolean;
  /** 週の切り替え中（前の週の枠を薄く出す） */
  dimmed: boolean;
  onSlotClick: (date: string, hour: number) => void;
};

/** 見出しの曜日の色。土曜は青、日曜は赤 */
function dayColor(date: string): string {
  const day = dayOfWeek(date);
  return day === 6
    ? "text-blue-600"
    : day === 0
      ? "text-red-500"
      : "text-zinc-700";
}

/** その枠が、選択とどういう関係か */
function selectionStateOf(
  selection: Selection,
  date: string,
  hour: number,
  getStatus: GetSlotStatus,
  rules: LengthRules,
): SlotSelectionState {
  if (
    selection.kind === "start" &&
    selection.date === date &&
    selection.hour === hour
  ) {
    return "start";
  }
  if (
    selection.kind === "complete" &&
    selection.date === date &&
    selection.startHour <= hour &&
    hour < selection.endHour
  ) {
    return "selected";
  }
  if (canBeEnd(selection, { date, hour }, getStatus, rules)) {
    return "candidate";
  }
  return "none";
}

export function CalendarGrid({
  weekStart,
  today,
  rules,
  getStatus,
  selection,
  loading,
  dimmed,
  onSlotClick,
}: Props) {
  // 週が決まっていなければ、日付の代わりに null を7つ並べる（見出し・枠をスケルトンにする）
  const days: (string | null)[] = Array.from({ length: 7 }, (_, i) =>
    weekStart === null ? null : addDays(weekStart, i),
  );
  const hours = Array.from(
    { length: rules.close_hour - rules.open_hour },
    (_, i) => rules.open_hour + i,
  );

  return (
    <div
      // 切り替え中は薄くし、読み込み中であることを画面読み上げにも伝える
      aria-busy={loading || dimmed}
      className={[
        "overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-xl transition-opacity",
        dimmed ? "opacity-50" : "",
      ].join(" ")}
    >
      <table className="w-full min-w-[22rem] table-fixed border-collapse text-sm">
        <thead>
          <tr className="divide-x divide-zinc-200 border-b border-zinc-200">
            <th
              scope="col"
              className="w-14 py-3 text-center font-medium text-zinc-800 sm:w-28"
            >
              時間
            </th>
            {days.map((date, index) => {
              if (date === null) {
                return (
                  <th key={index} scope="col" className="py-3">
                    <Skeleton className="mx-auto h-12 w-8" />
                  </th>
                );
              }
              const isToday = date === today;
              return (
                <th key={date} scope="col" className="py-3 text-center">
                  <div className={`text-lg font-semibold ${dayColor(date)}`}>
                    {formatDayOfWeekShort(date)}
                  </div>
                  <div
                    className={[
                      "mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm",
                      isToday
                        ? "bg-green-600 font-bold text-white"
                        : dayColor(date),
                    ].join(" ")}
                  >
                    {Number(date.slice(8))}
                    {isToday && <span className="sr-only">（今日）</span>}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => (
            <tr
              key={hour}
              className="divide-x divide-zinc-200 border-b border-zinc-200 last:border-0"
            >
              <th
                scope="row"
                className="py-2 text-center text-xs font-normal text-zinc-800"
              >
                <span className="sm:hidden">{formatHour(hour)}</span>
                <span className="hidden sm:inline">
                  {formatHourRange(hour, hour + 1)}
                </span>
              </th>
              {days.map((date, index) =>
                loading || date === null ? (
                  <td key={date ?? index} className="px-1 py-1.5 sm:px-1.5">
                    <Skeleton className="h-6 w-full rounded-md" />
                  </td>
                ) : (
                  <SlotCell
                    key={date}
                    date={date}
                    hour={hour}
                    status={getStatus(date, hour)}
                    selectionState={selectionStateOf(
                      selection,
                      date,
                      hour,
                      getStatus,
                      rules,
                    )}
                    onClick={() => onSlotClick(date, hour)}
                  />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
