"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRedirectToLoginOnUnauthorized } from "@/features/auth/hooks";
import { useMyReservations } from "../hooks";
import type { Reservation } from "../types";
import { CancelDialog } from "./CancelDialog";
import { ReservationCard } from "./ReservationCard";

/*
 * マイページの「今後のご予約」の一覧（docs/08 の 5.1）。
 *
 * | 状態       | 表示                                                         |
 * |------------|--------------------------------------------------------------|
 * | 読み込み中 | カード2枚分のスケルトン                                      |
 * | 失敗       | 「予約を取得できませんでした」+「再読み込み」               |
 * | 空         | 「今後の予約はありません」+「空き状況を見る」（トップへ）  |
 * | あり       | 日付順のカード（並びはサーバーが決める）                    |
 *
 * キャンセルできたら、一覧の上に「予約をキャンセルしました」を出し、そこへフォーカスを移す
 * （キャンセルした予約のカードは一覧から消えるので、フォーカスを戻す場所が無いため。docs/08 の 1.3）。
 * 一覧は 6-5 の hook が取り直すので、ここでは何もしなくてよい。
 */
export function MyReservationList() {
  const reservations = useMyReservations();
  // キャンセルの確認ダイアログを開いている予約
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const cancelledMessageRef = useRef<HTMLDivElement>(null);

  // セッションが切れていたら（401）、ログイン画面へ
  useRedirectToLoginOnUnauthorized(reservations.error);

  useEffect(() => {
    if (cancelled) {
      cancelledMessageRef.current?.focus();
    }
  }, [cancelled]);

  return (
    <div className="space-y-4">
      {cancelled && (
        <div ref={cancelledMessageRef} tabIndex={-1} className="outline-none">
          <Alert tone="success">予約をキャンセルしました</Alert>
        </div>
      )}

      <ListBody
        reservations={reservations.data}
        loading={reservations.isPending}
        failed={reservations.isError}
        onRetry={() => void reservations.refetch()}
        onCancel={(reservation) => {
          setCancelled(false);
          setCancelTarget(reservation);
        }}
      />

      <CancelDialog
        reservation={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={() => {
          setCancelTarget(null);
          setCancelled(true);
        }}
      />
    </div>
  );
}

/** 一覧の中身（状態ごとの出し分け） */
function ListBody({
  reservations,
  loading,
  failed,
  onRetry,
  onCancel,
}: {
  reservations: Reservation[] | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onCancel: (reservation: Reservation) => void;
}) {
  if (loading) {
    // カードと同じ大きさの枠を2枚（docs/08 の 1.1）
    return (
      <div aria-busy="true" className="space-y-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  // 取得の失敗を「予約が無い」と区別する（B15 と同じ考え方）
  if (failed || !reservations) {
    return (
      <ErrorState message="予約を取得できませんでした" onRetry={onRetry} />
    );
  }

  if (reservations.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white px-6 py-10 text-center">
        <p className="text-sm text-zinc-700">今後の予約はありません</p>
        {/* トップのカレンダーの見出し（id="calendar-heading"）へ */}
        <Link
          href="/#calendar-heading"
          className="mt-3 inline-block text-sm font-medium text-green-600 underline underline-offset-2"
        >
          空き状況を見る
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {reservations.map((reservation) => (
        <ReservationCard
          key={reservation.id}
          reservation={reservation}
          onCancel={onCancel}
        />
      ))}
    </ul>
  );
}
