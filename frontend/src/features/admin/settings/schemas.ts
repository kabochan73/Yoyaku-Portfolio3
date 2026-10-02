import { z } from "zod";

/*
 * 料金設定のフォームの入力ルール（docs/08 の 6.4）。backend の UpdatePricesRequest と同じ決まり。
 *
 * 入力欄の値は文字列なので、「空でない・0以上の整数」を文字列のまま確かめてから数にする。
 * 【B16】空欄を 0円にしない（R1 は空欄が Number("") = 0 になり、0円で保存された）。
 */

/** 1時間あたりの料金（円）の入力欄 */
const yenPerHour = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label}を入力してください。`)
    .regex(/^\d+$/, `${label}は0以上の整数で入力してください。`)
    // ここで初めて数にする（ここまでで、空欄・小数・マイナスは弾いている）
    .transform(Number)
    .pipe(
      z.number().max(1_000_000, `${label}は1,000,000以下で入力してください。`),
    );

export const priceSchema = z.object({
  weekday: yenPerHour("平日の料金"),
  weekend: yenPerHour("土日の料金"),
});

/** フォームの入力欄の値（文字列） */
export type PriceInput = z.input<typeof priceSchema>;
/** 確かめた後の値（数） */
export type PriceValues = z.output<typeof priceSchema>;
