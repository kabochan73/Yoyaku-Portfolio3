"use client";

import Link from "next/link";
import "./globals.css";

/*
 * ルートのレイアウト自体が落ちたとき（docs/08 の 7）。めったに起きない（施設名の取得に失敗した など）。
 *
 * このページはルートのレイアウトの代わりに出るので、<html> と <body> から自分で書く（Next.js の決まり）。
 * ヘッダー・TanStack Query などは使わず、最小限の HTML で error.tsx と同じ文言を出す。
 * metadata は書けない（Client Component のため）ので、title は <title> で直接書く。
 */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="ja">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center">
        <title>ページを表示できませんでした</title>
        <h1 className="text-xl font-bold text-zinc-900">
          ページを表示できませんでした
        </h1>
        <p className="text-sm text-zinc-600">
          時間をおいて、もう一度お試しください。
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700"
        >
          再読み込み
        </button>
        <Link
          href="/"
          className="font-medium text-green-600 underline underline-offset-2"
        >
          トップページへ戻る
        </Link>
      </body>
    </html>
  );
}
