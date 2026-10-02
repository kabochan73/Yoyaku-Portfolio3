"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/*
 * ページを表示できなかったとき（docs/08 の 7）。ログインが必要なページで、API が落ちているときなど。
 * ヘッダーはルートのレイアウトが出す（ルートのレイアウト自体が落ちたときは global-error.tsx）。
 *
 * Next.js の決まりで Client Component（エラーを受け止める部品は、ブラウザ側で動く必要がある）。
 *
 * - 「再読み込み」は Next.js が渡す retry() を呼ぶ。そのページのデータを取り直して描き直す。
 *   （Next.js 16 では retry。前の版の reset は、データを取り直さずに描き直すだけなので使わない）
 * - エラーの中身は画面に出さない。本番では、Next.js がサーバーのエラーの中身を伏せて、番号（digest）だけを渡す。
 *   調べるときのために、番号をブラウザの開発者ツールに出しておく
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("ページを表示できませんでした", error.digest ?? error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-zinc-900">
        ページを表示できませんでした
      </h1>
      <p className="text-sm text-zinc-600">
        時間をおいて、もう一度お試しください。
      </p>
      <Button variant="secondary" onClick={() => retry()}>
        再読み込み
      </Button>
      <Link
        href="/"
        className="font-medium text-green-600 underline underline-offset-2"
      >
        トップページへ戻る
      </Link>
    </main>
  );
}
