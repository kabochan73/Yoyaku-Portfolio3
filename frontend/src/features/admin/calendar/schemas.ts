import { z } from "zod";

/*
 * 電話予約のフォームの入力ルール（docs/08 の 6.3）。backend の StorePhoneReservationRequest と同じ決まり。
 */
export const phoneReservationSchema = z.object({
  // reservations.booker_name は varchar(255)
  booker_name: z
    .string()
    .trim()
    .min(1, "予約者名を入力してください。")
    .max(255, "予約者名は255文字以内で入力してください。"),
});

export type PhoneReservationValues = z.infer<typeof phoneReservationSchema>;
