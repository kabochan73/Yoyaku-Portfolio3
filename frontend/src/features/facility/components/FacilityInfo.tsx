import { formatDayOfWeek, formatHourRange, formatYen } from "@/lib/format";
import type { Facility } from "../types";

/*
 * 施設の案内（営業時間・料金・定休日・利用時間・レンタル・支払い。docs/08 の 3）。
 *
 * 営業時間・料金・定休日・利用時間は、施設情報（GET /api/facility）から作る（D1）。
 * R1 は営業時間「10:00〜22:00」と利用時間「最低2時間〜最大4時間」を直接書き、
 * 料金・定休日も API に届かないときは仮の値（4000円・月曜）を出していた。
 *
 * レンタル・支払い方法は API に無い説明文なので、ここに書く（docs/01 の 1）。
 *
 * 表示するだけなので Server Component（静的な HTML に入る）。
 */

type Props = {
  facility: Facility;
};

export function FacilityInfo({ facility }: Props) {
  const { rules, prices, regular_holidays } = facility;

  const items = [
    {
      label: "営業時間",
      value: formatHourRange(rules.open_hour, rules.close_hour),
    },
    {
      label: "料金（1時間）",
      value: `平日 ${formatYen(prices.weekday)}・土日 ${formatYen(prices.weekend)}`,
    },
    {
      label: "定休日",
      value:
        regular_holidays.length > 0
          ? regular_holidays.map(formatDayOfWeek).join("・")
          : "なし",
    },
    {
      label: "利用時間",
      value: `${rules.min_hours}〜${rules.max_hours}時間`,
    },
    { label: "レンタル", value: "ボール・ビブス無料" },
    { label: "支払い方法", value: "現地払いのみ" },
  ];

  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      {/* 項目名と値の組なので、説明リスト（dl）にする */}
      <dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1 text-green-600">
              ●
            </span>
            <div>
              <dt className="text-sm text-zinc-500">{item.label}</dt>
              <dd className="font-semibold text-zinc-900">{item.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
