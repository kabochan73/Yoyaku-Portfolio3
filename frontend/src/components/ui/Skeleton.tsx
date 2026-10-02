/*
 * 読み込み中に出す灰色の枠（スケルトン。docs/08 の 1.1）。
 *
 * 最終的に出る部品と同じ大きさにして（大きさは className で指定する）、
 * データが届いて差し替わったときに、レイアウトがずれないようにする。
 * R1 はスピナーを出すか、何も出さなかったので、表示が後から出てガタついていた。
 *
 * 使い方: <Skeleton className="h-9 w-24" />
 *
 * 状態を持たない部品なので "use client" を付けない。
 */

type Props = {
  /** 大きさ・形（例: "h-9 w-24 rounded-lg"） */
  className?: string;
};

export function Skeleton({ className = "" }: Props) {
  return (
    <div
      // 中身の無い飾りなので、画面読み上げには読ませない（読み込み中であることは、使う側で伝える）
      aria-hidden="true"
      className={["animate-pulse rounded bg-zinc-200", className].join(" ")}
    />
  );
}
