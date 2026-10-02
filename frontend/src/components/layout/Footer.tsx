import type { Facility } from "@/features/facility/types";
import { formatHourRange } from "@/lib/format";

/*
 * 全ページの下に出すフッター（docs/08 の 2）。
 *
 * 施設名・電話番号・受付時間・メール・住所は、すべて施設情報（GET /api/facility）から出す（D14）。
 * R1 はヒーロー・フッター・メールにそれぞれ直接書いていて、電話番号が食い違っていた。
 * 受付時間も、営業時間のルール（rules.open_hour・close_hour）から作る（D1。R1 は "10:00〜22:00" を直書き）。
 *
 * 施設情報は (site)/layout.tsx がサーバーで取って渡す。
 * 表示するだけの部品なので "use client" を付けない（静的な HTML に入る）。
 */

type Props = {
  facility: Facility;
};

export function Footer({ facility }: Props) {
  return (
    <footer className="bg-zinc-900 py-8 text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-10 px-4">
        <div className="flex flex-wrap gap-10">
          <div>
            {/* 押すと電話をかけられる（スマホ） */}
            <a
              href={`tel:${facility.phone}`}
              className="font-bold hover:underline"
            >
              {facility.phone}
            </a>
            <p className="text-xs text-zinc-400">
              受付時間{" "}
              {formatHourRange(
                facility.rules.open_hour,
                facility.rules.close_hour,
              )}
            </p>
            <a
              href={`mailto:${facility.email}`}
              className="text-xs text-zinc-400 hover:underline"
            >
              {facility.email}
            </a>
          </div>
          <address className="text-sm not-italic">{facility.address}</address>
        </div>

        <p className="text-2xl font-bold tracking-wide">{facility.name}</p>
      </div>
    </footer>
  );
}
