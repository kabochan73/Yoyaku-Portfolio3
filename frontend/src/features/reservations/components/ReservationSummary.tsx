import { formatDateJa, formatHourRange, formatYen } from "@/lib/format";

/*
 * 予約の内容の表（日付・時間・利用時間・料金。docs/08 の 10）。
 *
 * 予約の確認・キャンセルの確認（6-7）・管理画面の予約の詳細と電話予約（手順7）で使う。
 * R1 は同じ表が4つのモーダルにコピーされていて、日付の書き方もそれぞれ違っていた。
 *
 * 表示するだけの部品なので "use client" を付けない。
 */

type Props = {
  date: string;
  startHour: number;
  endHour: number;
  /** 金額（円） */
  price: number;
  /** 金額の後ろに付ける言葉。見積もりなら "（見積もり）" */
  priceNote?: string;
};

export function ReservationSummary({
  date,
  startHour,
  endHour,
  price,
  priceNote,
}: Props) {
  const rows = [
    { label: "日付", value: formatDateJa(date) },
    { label: "時間", value: formatHourRange(startHour, endHour) },
    { label: "利用時間", value: `${endHour - startHour}時間` },
    { label: "合計料金", value: `${formatYen(price)}${priceNote ?? ""}` },
  ];

  return (
    <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex gap-4 px-4 py-2">
          <dt className="w-20 shrink-0 text-zinc-500">{row.label}</dt>
          <dd className="font-medium text-zinc-900">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
