import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormField } from "@/components/ui/FormField";
import { useRedirectToLoginOnUnauthorized } from "@/features/auth/hooks";
import { useFacility } from "@/features/facility/hooks";
import { estimatePrice } from "@/features/facility/price";
import type { SelectedSlot } from "@/features/reservations/components/ReservationConfirmDialog";
import { ReservationSummary } from "@/features/reservations/components/ReservationSummary";
import { applyServerErrors } from "@/lib/form-errors";
import { toApiError } from "@/lib/api-error";
import { useCreatePhoneReservation } from "../hooks";
import {
  phoneReservationSchema,
  type PhoneReservationValues,
} from "../schemas";

/*
 * 電話予約の登録ダイアログ（docs/08 の 6.3）。管理カレンダーで空きの枠を2つ選び終わったら開く。
 *
 *   日付 / 時間 / 利用時間 / 合計料金（見積もり）
 *   予約者名 [          ]
 *   [戻る] [登録する]
 *
 * - 予約者名は必須・255文字以内。React Hook Form + zod（R1 は useState で手で管理していた）
 * - 開いたら予約者名の欄にカーソルを移す（autoFocus。Dialog が中の autoFocus の要素に移す）。Enter で送信
 * - エラーは会員の予約確認ダイアログと同じ（409 slot_taken なら「登録する」を押せなくする など）
 *
 * AdminCalendar の子として import されるので、"use client" は書かない。
 */

type Props = {
  /** 選んだ時間帯。null なら閉じている */
  slot: SelectedSlot | null;
  onClose: () => void;
  onReserved: () => void;
};

export function PhoneReservationDialog({ slot, onClose, onReserved }: Props) {
  const { data: facility } = useFacility();
  const createReservation = useCreatePhoneReservation();
  const [formError, setFormError] = useState<string | null>(null);
  useRedirectToLoginOnUnauthorized(createReservation.error);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<PhoneReservationValues>({
    resolver: zodResolver(phoneReservationSchema),
    defaultValues: { booker_name: "" },
  });

  const close = () => {
    // 次に開いたときに、前の入力・エラーが残らないようにする
    reset();
    setFormError(null);
    createReservation.reset();
    onClose();
  };

  const onSubmit = (values: PhoneReservationValues) => {
    if (!slot) {
      return;
    }
    setFormError(null);
    createReservation.mutate(
      {
        date: slot.date,
        start_hour: slot.startHour,
        end_hour: slot.endHour,
        booker_name: values.booker_name,
      },
      {
        onSuccess: () => {
          reset();
          createReservation.reset();
          onReserved();
        },
        onError: (error) =>
          setFormError(applyServerErrors(error, setError, ["booker_name"])),
      },
    );
  };

  const error = createReservation.error
    ? toApiError(createReservation.error)
    : null;

  return (
    <Dialog
      open={slot !== null}
      onClose={close}
      title="電話予約の登録"
      busy={createReservation.isPending}
    >
      {slot && facility && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4"
        >
          <ReservationSummary
            date={slot.date}
            startHour={slot.startHour}
            endHour={slot.endHour}
            price={estimatePrice(
              slot.date,
              slot.endHour - slot.startHour,
              facility.prices,
            )}
            priceNote="（見積もり）"
          />

          <FormField
            id="phone-booker-name"
            label="予約者名"
            error={errors.booker_name?.message}
          >
            {(control) => (
              // autoFocus: ダイアログを開いたら、最初に入力する欄へ移す（docs/08 の 6.3）
              <input
                type="text"
                autoFocus
                {...control}
                {...register("booker_name")}
              />
            )}
          </FormField>

          {formError && <Alert tone="error">{formError}</Alert>}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={close}
              disabled={createReservation.isPending}
            >
              戻る
            </Button>
            <Button
              type="submit"
              loading={createReservation.isPending}
              loadingText="登録中..."
              // 409 slot_taken の後は、同じ枠ではもう登録できない
              disabled={error?.code === "slot_taken"}
            >
              登録する
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
