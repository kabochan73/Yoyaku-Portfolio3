import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { toApiError } from "@/lib/api-error";
import { formatDateJa } from "@/lib/format";
import { useDeleteHoliday, useHolidays } from "../hooks";
import type { Holiday } from "../types";

/*
 * 今日以降の臨時休業日の一覧（docs/08 の 6.6）。
 *
 * | 状態       | 表示                                               |
 * |------------|----------------------------------------------------|
 * | 読み込み中 | 行2つ分のスケルトン                                |
 * | 失敗       | 「休業日を取得できませんでした」+「再読み込み」   |
 * | 空         | 「登録された休業日はありません」                   |
 * | 行         | 2026年10月10日（土）— 設備点検  [削除]             |
 *
 * 「削除」は確認のダイアログを挟む（R1 は1回押すだけで消えた）。
 * HolidayManager の子として import されるので、"use client" は書かない。
 */
export function HolidayList() {
  const holidays = useHolidays();
  const deleteHoliday = useDeleteHoliday();
  // 解除の確認ダイアログを開いている休業日
  const [target, setTarget] = useState<Holiday | null>(null);

  const close = () => {
    deleteHoliday.reset();
    setTarget(null);
  };

  if (holidays.isPending) {
    return (
      <div aria-busy="true" className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (holidays.isError) {
    return (
      <ErrorState
        message="休業日を取得できませんでした"
        onRetry={() => void holidays.refetch()}
      />
    );
  }

  const error = deleteHoliday.error ? toApiError(deleteHoliday.error) : null;

  return (
    <>
      {holidays.data.length === 0 ? (
        <p className="text-sm text-zinc-500">登録された休業日はありません</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
          {holidays.data.map((holiday) => (
            <li
              key={holiday.id}
              className="flex items-center justify-between gap-4 px-4 py-2"
            >
              <span className="text-sm text-zinc-900">
                {formatDateJa(holiday.date)}
                {holiday.reason && (
                  <span className="text-zinc-500"> — {holiday.reason}</span>
                )}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTarget(holiday)}
                aria-label={`${formatDateJa(holiday.date)} の休業日を削除`}
              >
                削除
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={target !== null}
        onClose={close}
        title="休業日を解除しますか？"
        busy={deleteHoliday.isPending}
      >
        {target && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-700">
              {formatDateJa(target.date)}{" "}
              の休業日を解除します。キャンセルした予約は元に戻りません。
            </p>
            {error && <Alert tone="error">{error.message}</Alert>}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={close}
                disabled={deleteHoliday.isPending}
              >
                戻る
              </Button>
              <Button
                variant="danger"
                loading={deleteHoliday.isPending}
                loadingText="解除中..."
                onClick={() =>
                  deleteHoliday.mutate(target.id, {
                    onSuccess: () => {
                      deleteHoliday.reset();
                      setTarget(null);
                    },
                  })
                }
              >
                解除する
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
