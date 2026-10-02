"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFacility } from "@/features/facility/hooks";
import { applyServerErrors } from "@/lib/form-errors";
import { useUpdatePrices } from "../hooks";
import { priceSchema, type PriceInput, type PriceValues } from "../schemas";

/*
 * 料金設定のフォーム（docs/08 の 6.4）。管理画面の「料金設定」のアコーディオンの中に出す。
 *
 * | 状態       | 表示・動作                                                      |
 * |------------|-----------------------------------------------------------------|
 * | 読み込み中 | 入力欄2つ分のスケルトン。保存ボタンを出さない（B16）            |
 * | 失敗       | 「料金を取得できませんでした」+「再読み込み」                   |
 * | 入力       | 平日・土日（円/時間）。0以上の整数。空欄は項目のエラー          |
 * | 保存中     | 「保存中...」                                                   |
 * | 成功       | 「保存しました。トップページにも反映されました」（入力を変えたら消す）|
 *
 * 【B16】R1 は、値が届く前に「保存する」を押すと、空欄が 0円で保存された。
 * R2 は、値が届くまでフォームそのものを出さない。届いたら今の値を入れる（useForm の values）。
 */
export function PriceForm() {
  const facility = useFacility();

  if (facility.isPending) {
    return (
      <div aria-busy="true" className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (facility.isError || !facility.data) {
    return (
      <ErrorState
        message="料金を取得できませんでした"
        onRetry={() => void facility.refetch()}
      />
    );
  }

  return <PriceFields prices={facility.data.prices} />;
}

/** 値が届いた後のフォーム */
function PriceFields({
  prices,
}: {
  prices: { weekday: number; weekend: number };
}) {
  const updatePrices = useUpdatePrices();
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PriceInput, unknown, PriceValues>({
    resolver: zodResolver(priceSchema),
    // 今の値を入れる。保存して施設情報が置き換わったら、その値に入れ直される
    values: {
      weekday: String(prices.weekday),
      weekend: String(prices.weekend),
    },
  });

  const onSubmit = (values: PriceValues) => {
    setSaved(false);
    setFormError(null);
    updatePrices.mutate(values, {
      onSuccess: () => setSaved(true),
      onError: (error) =>
        setFormError(
          applyServerErrors(error, setError, ["weekday", "weekend"]),
        ),
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      // 入力が変わったら「保存しました」を消す
      onChange={() => setSaved(false)}
      noValidate
      className="space-y-4"
    >
      {saved && (
        <Alert tone="success">
          保存しました。トップページにも反映されました
        </Alert>
      )}
      {formError && <Alert tone="error">{formError}</Alert>}

      <FormField
        id="price-weekday"
        label="平日（円/時間）"
        error={errors.weekday?.message}
      >
        {(control) => (
          <input
            type="number"
            inputMode="numeric"
            min={0}
            {...control}
            {...register("weekday")}
          />
        )}
      </FormField>

      <FormField
        id="price-weekend"
        label="土日（円/時間）"
        error={errors.weekend?.message}
      >
        {(control) => (
          <input
            type="number"
            inputMode="numeric"
            min={0}
            {...control}
            {...register("weekend")}
          />
        )}
      </FormField>

      <Button
        type="submit"
        loading={updatePrices.isPending}
        loadingText="保存中..."
      >
        保存する
      </Button>
    </form>
  );
}
