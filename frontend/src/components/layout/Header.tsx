import Link from "next/link";
import { HeaderUserMenu } from "./HeaderUserMenu";

/*
 * 全ページの上に出すヘッダー（docs/05 の「レイアウト・共通」、docs/08）。
 *
 * ロゴのように動かない部分は Server Component のまま静的な HTML に入れ、
 * ログイン状態で変わる右側だけを HeaderUserMenu（Client Component）に切り出す。
 * R1 はヘッダー全体が "use client" だった。
 *
 * ここではログイン状態を読まない（Cookie を読むと、トップページが静的でなくなるため。docs/05）。
 */
export function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-lg font-bold tracking-wide text-green-600 sm:text-2xl"
        >
          FUTSAL PARK
        </Link>

        <HeaderUserMenu />
      </div>
    </header>
  );
}
