import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { ApiError, toApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/form-errors";
import { todayInTokyo } from "@/lib/date";
import { useCreateHoliday } from "../hooks";
import { holidaySchema, type HolidayValues } from "../schemas";
import { HolidayConflictDialog } from "./HolidayConflictDialog";

/*
 * 臨時休業日の追加フォーム（docs/08 の 6.6）。日付（今日以降）+ 理由（任意）+「休業日を追加」。
 *
 * | 結果                              | 表示・動作                                           |
 * |-----------------------------------|------------------------------------------------------|
 * | 201                               | フォームを空に戻す（一覧は hook が取り直す）         |
 * | 409 holiday_has_reservations      | 確認ダイアログを開く。承認したら cancel_reservations: true で送り直す |
 * | 409 holiday_already_exists        | 日付の欄の下に「すでに休業日として登録されています」|
 * | 422                               | 項目ごと                                             |
 *
 * HolidayManager の子として import されるので、"use client" は書かない。
 */
export function HolidayForm() {
  const createHoliday = useCreateHoliday();
  const [formError, setFormError] = useState<string | null>(null);
  // 確認ダイアログ: 送ろうとした値と、キャンセルされる予約の件数
  const [conflict, setConflict] = useState<{
    values: HolidayValues;
    count: number;
  } | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<HolidayValues>({
    resolver: zodResolver(holidaySchema),
    defaultValues: { date: "", reason: "" },
  });

  /** 送る。cancelReservations が true なら、予約をキャンセルしてよいと確認済み */
  const send = (values: HolidayValues, cancelReservations: boolean) =>
    createHoliday.mutate(
      {
        date: values.date,
        reason: values.reason === "" ? null : values.reason,
        cancel_reservations: cancelReservations,
      },
      {
        onSuccess: () => {
          reset();
          setConflict(null);
        },
        onError: (error) => {
          const apiError = toApiError(error);

          if (apiError.code === "holiday_has_reservations") {
            setConflict({ values, count: reservationCountOf(apiError) });
            return;
          }
          if (cancelReservations) {
            // 確認ダイアログから送り直して失敗した → ダイアログの中に出す
            setConflictError(apiError.message);
            return;
          }
          if (apiError.code === "holiday_already_exists") {
            setError("date", { type: "server", message: apiError.message });
            return;
          }
          setFormError(applyServerErrors(error, setError, ["date", "reason"]));
        },
      },
    );

  const onSubmit = (values: HolidayValues) => {
    setFormError(null);
    send(values, false);
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="holiday-date"
            label="日付"
            error={errors.date?.message}
          >
            {(control) => (
              // 今日より前は選べないようにする（サーバーも確かめる。R1 は過去の日も登録できた）
              <input
                type="date"
                min={todayInTokyo()}
                {...control}
                {...register("date")}
              />
            )}
          </FormField>

          <FormField
            id="holiday-reason"
            label="理由（任意）"
            error={errors.reason?.message}
          >
            {(control) => (
              <input
                type="text"
                placeholder="設備点検"
                {...control}
                {...register("reason")}
              />
            )}
          </FormField>
        </div>

        <Button
          type="submit"
          loading={createHoliday.isPending && conflict === null}
          loadingText="追加中..."
        >
          休業日を追加
        </Button>
      </form>

      <HolidayConflictDialog
        reservationCount={conflict?.count ?? null}
        busy={createHoliday.isPending}
        error={conflictError}
        onConfirm={() => {
          if (conflict) {
            setConflictError(null);
            send(conflict.values, true);
          }
        }}
        onClose={() => {
          setConflict(null);
          setConflictError(null);
        }}
      />
    </>
  );
}

/** 409 holiday_has_reservations のレスポンスから、予約の件数を読む（{ ..., "reservation_count": 2 }） */
function reservationCountOf(error: ApiError): number {
  const body = error.body as { reservation_count?: unknown } | null;
  return typeof body?.reservation_count === "number"
    ? body.reservation_count
    : 0;
}
