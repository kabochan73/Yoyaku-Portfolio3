"use client";

import { useState } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { CalendarGrid } from "@/features/calendar/components/CalendarGrid";
import { SelectionHint } from "@/features/calendar/components/SelectionHint";
import { WeekNavigator } from "@/features/calendar/components/WeekNavigator";
import {
  IDLE,
  selectSlot,
  type GetSlotStatus,
  type Selection,
} from "@/features/calendar/selection";
import type { ClosedReason } from "@/features/calendar/types";
import { useFacility } from "@/features/facility/hooks";
import { useRedirectToLoginOnUnauthorized } from "@/features/auth/hooks";
import { addDays, mondayOf, todayInTokyo } from "@/lib/date";
import { formatWeekRange } from "@/lib/format";
import { useAdminCalendar } from "../hooks";
import type { AdminCalendarDay, AdminReservation } from "../types";
import { AdminReservationDialog } from "./AdminReservationDialog";
import { PhoneReservationDialog } from "./PhoneReservationDialog";

/*
 * 管理画面の予約カレンダー（docs/08 の 6.1）。
 *
 * トップの会員用カレンダー（BookingCalendar）と同じ部品（WeekNavigator・CalendarGrid・SelectionHint）と
 * 同じ枠選択のルール（selection.ts）を使い、違うところだけをここに書く:
 *
 * | 枠                         | 表示                                   | 押したとき                     |
 * |----------------------------|----------------------------------------|--------------------------------|
 * | 予約済み                   | 予約者名（電話予約は「☎」付き）       | 予約の詳細ダイアログ           |
 * | 受付外の日の予約済み（B11）| 予約者名                               | 予約の詳細ダイアログ           |
 * | 受付外の日の予約なし       | －                                     | 何もしない                     |
 * | 空き                       | 空き                                   | 電話予約の開始・終了の選択     |
 *
 * - 受付外の日は、見出しに理由を小さく出す（定休日・休業日）
 * - 週送り: 前は予約の保持期間（3か月）の週まで、次は制限なし
 * - 管理画面はアクセスごとに描くページなので、「今日」はそのまま計算してよい（トップのような静的ページではない）
 */
export function AdminCalendar() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayInTokyo()));
  const { data: facility } = useFacility();
  const calendar = useAdminCalendar(weekStart);
  const [selection, setSelection] = useState<Selection>(IDLE);
  // 詳細を開いている予約
  const [openReservation, setOpenReservation] =
    useState<AdminReservation | null>(null);

  // セッションが切れていたら（401）、ログイン画面へ
  useRedirectToLoginOnUnauthorized(calendar.error);

  const data = calendar.data;
  const days = data?.data;
  const switching = calendar.isPlaceholderData;
  const getStatus = makeGetStatus(weekStart, days);

  if (!facility) {
    // 施設情報（営業時間）が届くまでは、表の形（行の数）が決まらない。
    // 管理画面には FacilityProvider が無い（料金の設定などで、保存されている最新の値を API から取るため）ので、
    // 最初の1回だけ /api/facility を待つ。その間は、表と同じくらいの大きさの枠を出しておく
    return (
      <section
        aria-labelledby="admin-calendar-heading"
        aria-busy="true"
        className="space-y-3"
      >
        <h2
          id="admin-calendar-heading"
          className="text-lg font-semibold text-zinc-900"
        >
          予約カレンダー
        </h2>
        <Skeleton className="h-[36rem] w-full rounded-xl" />
      </section>
    );
  }
  const rules = facility.rules;

  const changeWeek = (next: string) => {
    setSelection(IDLE);
    setWeekStart(next);
  };

  /** その枠に入っている予約（列の i 番目には、データの i 番目の日を当てる） */
  const reservationAt = (
    date: string,
    hour: number,
  ): AdminReservation | undefined => {
    const day = dayOf(weekStart, days, date);
    const reservationId = day?.slots.find(
      (slot) => slot.hour === hour,
    )?.reservation_id;
    return day?.reservations.find(
      (reservation) => reservation.id === reservationId,
    );
  };

  return (
    <section aria-labelledby="admin-calendar-heading" className="space-y-3">
      <h2
        id="admin-calendar-heading"
        className="text-lg font-semibold text-zinc-900"
      >
        予約カレンダー
      </h2>

      <WeekNavigator
        weekLabel={formatWeekRange(weekStart)}
        // 保持期間より前の日は、サーバーが枠を空で返す。週の最初の日が空なら、それより前には戻れない
        canGoPrev={(days?.[0]?.slots.length ?? 0) > 0}
        canGoNext={data !== undefined}
        onPrev={() => changeWeek(addDays(weekStart, -7))}
        onNext={() => changeWeek(addDays(weekStart, 7))}
      />

      {calendar.isError && !data ? (
        <ErrorState
          message="予約カレンダーを取得できませんでした"
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
            today={data?.meta.today ?? todayInTokyo()}
            rules={rules}
            getStatus={getStatus}
            selection={selection}
            loading={!data}
            dimmed={switching}
            onSlotClick={(date, hour) => {
              if (switching) {
                return;
              }
              setSelection((current) =>
                selectSlot(current, { date, hour }, getStatus, rules),
              );
            }}
            getBookedLabel={(date, hour) => {
              const reservation = reservationAt(date, hour);
              if (!reservation) {
                return undefined;
              }
              return reservation.is_phone
                ? `☎ ${reservation.booker_name}`
                : reservation.booker_name;
            }}
            onBookedClick={(date, hour) => {
              if (switching) {
                return;
              }
              setOpenReservation(reservationAt(date, hour) ?? null);
            }}
            closedReasons={closedReasonsOf(weekStart, days)}
          />
        </>
      )}

      <AdminReservationDialog
        reservation={openReservation}
        onClose={() => setOpenReservation(null)}
        onCancelled={() => setOpenReservation(null)}
      />

      <PhoneReservationDialog
        slot={
          selection.kind === "complete"
            ? {
                date: selection.date,
                startHour: selection.startHour,
                endHour: selection.endHour,
              }
            : null
        }
        onClose={() => setSelection(IDLE)}
        onReserved={() => setSelection(IDLE)}
      />
    </section>
  );
}

/**
 * 表示中の週の列（月曜〜日曜）の日付から、その日のデータを引く。
 * 列の i 番目には、データの i 番目の日を当てる（週の切り替え中は前の週のデータが薄く出る。BookingCalendar と同じ）。
 */
function dayOf(
  weekStart: string,
  days: AdminCalendarDay[] | undefined,
  date: string,
): AdminCalendarDay | undefined {
  for (let i = 0; i < 7; i++) {
    if (addDays(weekStart, i) === date) {
      return days?.[i];
    }
  }
  return undefined;
}

/** 枠の状態を返す関数（データに無い枠は null） */
function makeGetStatus(
  weekStart: string,
  days: AdminCalendarDay[] | undefined,
): GetSlotStatus {
  return (date, hour) =>
    dayOf(weekStart, days, date)?.slots.find((slot) => slot.hour === hour)
      ?.status ?? null;
}

/** 見出しに出す、日ごとの受付外の理由 */
function closedReasonsOf(
  weekStart: string,
  days: AdminCalendarDay[] | undefined,
): Record<string, ClosedReason | null> {
  const reasons: Record<string, ClosedReason | null> = {};
  days?.forEach((day, index) => {
    reasons[addDays(weekStart, index)] = day.closed_reason;
  });
  return reasons;
}
