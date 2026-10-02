"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { CalendarGrid } from "@/features/calendar/components/CalendarGrid";
import { SelectionHint } from "@/features/calendar/components/SelectionHint";
import { WeekNavigator } from "@/features/calendar/components/WeekNavigator";
import { useCalendar } from "@/features/calendar/hooks";
import {
  IDLE,
  selectSlot,
  type GetSlotStatus,
  type Selection,
} from "@/features/calendar/selection";
import type { CalendarDay } from "@/features/calendar/types";
import { useFacility } from "@/features/facility/hooks";
import { addDays, mondayOf, todayInTokyo } from "@/lib/date";
import { formatWeekRange } from "@/lib/format";

/*
 * トップの週間カレンダー（docs/08 の 3）。空き状況を出し、枠を選ばせる。
 *
 * 表示する週と、選択の状態を持ち、次の部品をつなぐ:
 * - useCalendar（空き状況。60秒ごとに取り直す）・useFacility（営業時間・2〜4時間のルール）
 * - selectSlot（枠を押したときの次の状態。selection.ts）
 * - WeekNavigator・SelectionHint・CalendarGrid（表示）
 *
 * 選び終わったら、手順6で予約の確認ダイアログを開く。それまでは、選んだ内容を案内に出すだけ。
 *
 * 【「今日」はブラウザで決める】
 * トップは静的ページで、HTML はビルドのとき（と1時間ごとの作り直しのとき）に作られる。
 * そこで「今日」を計算すると、作った日の週が HTML に焼き込まれ、ブラウザで描き直したときに食い違う。
 * そこで、サーバーで描くときは「今日」を null（未定）にして、見出しと枠をスケルトンにしておき、
 * ブラウザで描き直したときに初めて日本時間の今日を決める（useSyncExternalStore の3つ目の引数がサーバー用の値）。
 * データが届いた後は、サーバーが返す「今日」（meta.today）を使う（docs/05。端末の時計に頼らない）。
 */

/** 「今日」は変化を見張る必要がないので、購読は何もしない */
const subscribeNothing = () => () => {};

export function BookingCalendar() {
  // サーバーで描くときは null、ブラウザでは日本時間の今日
  const clientToday = useSyncExternalStore(
    subscribeNothing,
    () => todayInTokyo(),
    () => null,
  );

  // 利用者が週送りで選んだ週の月曜日。まだ選んでいなければ null（今日の週を出す）
  const [chosenWeek, setChosenWeek] = useState<string | null>(null);
  const weekStart = chosenWeek ?? (clientToday ? mondayOf(clientToday) : null);

  if (weekStart === null || clientToday === null) {
    // サーバーで静的な HTML を作るとき。週が決まらないので、枠組みだけを出す
    return (
      <CalendarSection>
        <CalendarPlaceholder />
      </CalendarSection>
    );
  }

  return (
    <WeekCalendar
      weekStart={weekStart}
      clientToday={clientToday}
      onWeekChange={setChosenWeek}
    />
  );
}

/** 週が決まった後のカレンダー */
function WeekCalendar({
  weekStart,
  clientToday,
  onWeekChange,
}: {
  weekStart: string;
  clientToday: string;
  onWeekChange: (weekStart: string) => void;
}) {
  const { data: facility } = useFacility();
  const calendar = useCalendar(weekStart);
  const [selection, setSelection] = useState<Selection>(IDLE);

  // 施設情報は FacilityProvider がサーバーで取った値を入れているので、ここで無いことはない
  if (!facility) {
    return null;
  }

  const rules = facility.rules;
  const data = calendar.data;
  // 今日・予約できる最終日は、データが届いたらサーバーの値を使う（B13。フロントで計算しない）
  const today = data?.meta.today ?? clientToday;
  const bookableUntil = data?.meta.bookable_until;

  const getStatus = makeGetStatus(weekStart, data?.data);
  // 週の切り替え中（前の週のデータを仮に出している間）
  const switching = calendar.isPlaceholderData;

  const changeWeek = (next: string) => {
    // 週を変えたら選択は解除する（docs/08 の 3.5）
    setSelection(IDLE);
    onWeekChange(next);
  };

  const handleSlotClick = (date: string, hour: number) => {
    // 切り替え中の枠は前の週のものなので、押しても何もしない
    if (switching) {
      return;
    }
    setSelection((current) =>
      selectSlot(current, { date, hour }, getStatus, rules),
    );
  };

  return (
    <CalendarSection>
      <WeekNavigator
        weekLabel={formatWeekRange(weekStart)}
        // 今週より前には戻れない
        canGoPrev={weekStart > mondayOf(today)}
        // 予約できる最終日を含む週より先には進めない（最終日が分かるまでは進めない）
        canGoNext={
          bookableUntil !== undefined && addDays(weekStart, 7) <= bookableUntil
        }
        onPrev={() => changeWeek(addDays(weekStart, -7))}
        onNext={() => changeWeek(addDays(weekStart, 7))}
      />

      {/* 取得に失敗し、出せるデータも無いとき。全部「－」に見せない（B15） */}
      {calendar.isError && !data ? (
        <ErrorState
          message="空き状況を取得できませんでした"
          onRetry={() => void calendar.refetch()}
        />
      ) : (
        <>
          <SelectionHint
            selection={selection}
            getStatus={getStatus}
            rules={rules}
          />
          <CalendarGrid
            weekStart={weekStart}
            today={today}
            rules={rules}
            getStatus={getStatus}
            selection={selection}
            loading={!data}
            dimmed={switching}
            onSlotClick={handleSlotClick}
          />
        </>
      )}
    </CalendarSection>
  );
}

/**
 * 表示中の週の列（月曜〜日曜）ごとに、枠の状態を返す関数を作る。
 *
 * 列の i 番目には、データの i 番目の日を当てる。週の切り替え中は、データが前の週のもの（仮のデータ）なので、
 * 見出しは新しい週の日付のまま、枠には前の週の状態が薄く出る（docs/08 の 3.1）。
 * 受付外の日（closed_reason あり）と、データに無い時刻は null（枠なし）。
 */
function makeGetStatus(
  weekStart: string,
  days: CalendarDay[] | undefined,
): GetSlotStatus {
  const byDate = new Map<string, CalendarDay>();
  days?.forEach((day, index) => byDate.set(addDays(weekStart, index), day));

  return (date, hour) => {
    const day = byDate.get(date);
    if (!day || day.closed_reason !== null) {
      return null;
    }
    return day.slots.find((slot) => slot.hour === hour)?.status ?? null;
  };
}

/** カレンダーの外枠（見出しと背景） */
function CalendarSection({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="calendar-heading" className="bg-zinc-50 py-12">
      <div className="mx-auto max-w-5xl px-4">
        <h2
          id="calendar-heading"
          className="mb-4 text-xl font-bold text-zinc-900"
        >
          空き状況
        </h2>
        {children}
      </div>
    </section>
  );
}

/**
 * 週が決まる前（サーバーで静的な HTML を作るとき）に出す枠組み。
 * 週送り・案内・表の形は本物と同じにして、ブラウザで本物に替わったときにレイアウトがずれないようにする。
 */
function CalendarPlaceholder() {
  const { data: facility } = useFacility();
  if (!facility) {
    return null;
  }

  return (
    <>
      <WeekNavigator
        weekLabel=""
        canGoPrev={false}
        canGoNext={false}
        onPrev={() => {}}
        onNext={() => {}}
      />
      <SelectionHint
        selection={IDLE}
        getStatus={() => null}
        rules={facility.rules}
      />
      <CalendarGrid
        weekStart={null}
        today={null}
        rules={facility.rules}
        getStatus={() => null}
        selection={IDLE}
        loading
        dimmed={false}
        onSlotClick={() => {}}
      />
    </>
  );
}
