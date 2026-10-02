import Image from "next/image";
import { formatHourRange } from "@/lib/format";
import type { Facility } from "../types";

/*
 * トップの一番上（docs/08 の 3）。施設名・キャッチコピー・連絡先を、コートの写真の上に重ねて出す。
 *
 * 施設名・電話番号・住所・メールは施設情報から、受付時間は営業時間のルールから出す（D1・D14）。
 * R1 はすべて直接書いていた。
 *
 * 表示するだけなので Server Component（静的な HTML に入る）。
 */

type Props = {
  facility: Facility;
};

export function Hero({ facility }: Props) {
  return (
    <section className="relative h-96 w-full overflow-hidden">
      <Image
        src="/court.png"
        alt="屋内フットサルコート"
        fill
        // 最初に見える大きな画像なので、先に読み込む
        priority
        // 横幅いっぱいに出すので、画面の幅に合った大きさの画像を選ばせる
        sizes="100vw"
        className="object-cover"
      />
      {/* 左側を白くぼかして、文字を読みやすくする */}
      <div className="absolute inset-0 bg-linear-to-r from-white via-white/80 to-transparent" />

      <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col justify-center px-4">
        <div className="max-w-md">
          <p className="text-sm font-semibold text-green-600">
            屋内人工芝フットサルコート
          </p>
          <h1 className="mt-2 text-4xl font-bold text-zinc-900">
            {facility.name}
          </h1>
          <p className="mt-4 text-zinc-600">
            快適な屋内コートで、フットサルを楽しもう!
          </p>

          <div className="mt-6 flex flex-col gap-2 text-sm text-zinc-700">
            <p>
              {facility.phone}　受付時間{" "}
              {formatHourRange(
                facility.rules.open_hour,
                facility.rules.close_hour,
              )}
            </p>
            <p>{facility.address}</p>
            <p>{facility.email}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
