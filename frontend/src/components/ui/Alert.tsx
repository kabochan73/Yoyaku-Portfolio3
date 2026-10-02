import type { ReactNode } from "react";

/*
 * お知らせの枠（docs/08 の 1.1）。フォームの上のエラーや、「保存しました」などの成功の知らせに使う。
 *
 * - error   … 送信の失敗など。role="alert" で、画面読み上げがすぐに読み上げる
 * - success … 「予約しました」「保存しました」など
 * - info    … 補足の案内
 *
 * 状態を持たない部品なので "use client" を付けない。
 */

const TONE_CLASSES = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-green-200 bg-green-50 text-green-800",
  info: "border-zinc-200 bg-zinc-50 text-zinc-700",
} as const;

type Props = {
  tone?: keyof typeof TONE_CLASSES;
  children: ReactNode;
  className?: string;
};

export function Alert({ tone = "info", children, className = "" }: Props) {
  return (
    <div
      // エラーは今すぐ読み上げる（alert）。それ以外は手が空いたときに読み上げる（status）
      role={tone === "error" ? "alert" : "status"}
      className={[
        "rounded-lg border px-4 py-3 text-sm",
        TONE_CLASSES[tone],
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
