"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFacility } from "@/features/facility/hooks";
import { toApiError } from "@/lib/api-error";
import { formatDayOfWeek } from "@/lib/format";
import { useUpdateRegularHolidays } from "../hooks";

/*
 * 定休日設定のフォーム（docs/08 の 6.5）。管理画面の「定休日設定」のアコーディオンの中に出す。
 *
 * - 曜日7つのトグルボタン（押すたびに選ぶ・外す）。選ばれているかは aria-pressed で画面読み上げに伝える
 * - 読み込み中・失敗・保存の扱いは PriceForm と同じ（B16: 値が届くまで保存ボタンを出さない）
 *   R1 は、読み込む前に保存すると、定休日が全部消えた
 * - 保存ボタンの上に「すでに入っている予約はキャンセルされません」を常に出す（docs/01 の 6.3）
 * - 全部外して保存すると「定休日なし」になる
 */

/** 表示する曜日の順（月曜始まり。カレンダーと同じ）。値は 0 = 日曜 … 6 = 土曜 */
const DAYS_IN_ORDER = [1, 2, 3, 4, 5, 6, 0];

type FormValues = { days: number[] };

export function RegularHolidayForm() {
  const facility = useFacility();

  if (facility.isPending) {
    return (
      <div aria-busy="true">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (facility.isError || !facility.data) {
    return (
      <ErrorState
        message="定休日を取得できませんでした"
        onRetry={() => void facility.refetch()}
      />
    );
  }

  return <RegularHolidayFields current={facility.data.regular_holidays} />;
}

/** 値が届いた後のフォーム */
function RegularHolidayFields({ current }: { current: number[] }) {
  const updateRegularHolidays = useUpdateRegularHolidays();
  const [saved, setSaved] = useState(false);

  const { control, setValue, handleSubmit } = useForm<FormValues>({
    // 今の定休日を入れる。保存して施設情報が置き換わったら、その値に入れ直される
    values: { days: current },
  });
  // 今選ばれている曜日（押すたびに描き直す）
  const days = useWatch({ control, name: "days" });

  const toggle = (day: number) => {
    setSaved(false);
    setValue(
      "days",
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
    );
  };

  const onSubmit = (values: FormValues) => {
    setSaved(false);
    // 送る順は小さい順にそろえる（サーバーも小さい順で返す）
    updateRegularHolidays.mutate(
      [...values.days].sort((a, b) => a - b),
      {
        onSuccess: () => setSaved(true),
      },
    );
  };

  const error = updateRegularHolidays.error
    ? toApiError(updateRegularHolidays.error)
    : null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {saved && (
        <Alert tone="success">
          保存しました。トップページにも反映されました
        </Alert>
      )}
      {error && <Alert tone="error">{error.message}</Alert>}

      <fieldset>
        <legend className="mb-2 text-sm text-zinc-700">
          定休日にする曜日を選んでください
        </legend>
        <div className="flex flex-wrap gap-2">
          {DAYS_IN_ORDER.map((day) => {
            const selected = days.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(day)}
                className={[
                  "rounded-lg border px-3 py-2 text-sm font-medium transition",
                  "focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none",
                  selected
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
                ].join(" ")}
              >
                {formatDayOfWeek(day)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="text-xs text-zinc-500">
        すでに入っている予約はキャンセルされません
      </p>

      <Button
        type="submit"
        loading={updateRegularHolidays.isPending}
        loadingText="保存中..."
      >
        保存する
      </Button>
    </form>
  );
}
