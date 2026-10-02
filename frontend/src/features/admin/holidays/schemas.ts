import { z } from "zod";

/*
 * 臨時休業日の追加フォームの入力ルール（docs/08 の 6.6）。backend の StoreHolidayRequest と同じ決まり。
 * 「今日以降か」は、日付の欄の min と、サーバー（after_or_equal:today）が確かめる。
 */
export const holidaySchema = z.object({
  date: z.string().min(1, "日付を選んでください。"),
  // holidays.reason は varchar(255)。空なら理由なし
  reason: z.string().trim().max(255, "理由は255文字以内で入力してください。"),
});

export type HolidayValues = z.infer<typeof holidaySchema>;
