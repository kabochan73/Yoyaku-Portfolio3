import Link from "next/link";

/*
 * 見つからないページ（404。docs/08 の 7）。R1 と同じ文言。
 * 無い URL を開いたとき・notFound() を呼んだときに出る。ヘッダーはルートのレイアウトが出す。
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-zinc-900">
        お探しのページは見つかりませんでした
      </h1>
      <Link
        href="/"
        className="font-medium text-green-600 underline underline-offset-2"
      >
        トップページへ戻る
      </Link>
    </main>
  );
}
