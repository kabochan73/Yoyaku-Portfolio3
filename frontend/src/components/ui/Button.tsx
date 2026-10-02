import type { ButtonHTMLAttributes } from "react";

/*
 * ボタン（docs/05 の「UI 部品」）。
 *
 * R1 は同じ見た目の Tailwind のクラスを、ボタンごとにコピーしていた。
 * 見た目（種類・大きさ）と、送信中の振る舞いをここで1か所に決める。
 *
 * 状態を持たない、表示するだけの部品なので "use client" を付けない。
 * Server Component と Client Component のどちらからも使える（onClick を渡せるのは Client Component から）。
 */

/** 見た目の種類 */
const VARIANT_CLASSES = {
  /** 主な操作（予約する・登録する など）。緑（R1 の色を引き継ぐ） */
  primary: "bg-green-600 text-white hover:bg-green-700",
  /** 補助の操作（戻る・閉じる など） */
  secondary: "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
  /** 取り消せない操作（キャンセルする・削除する など）。赤 */
  danger: "bg-red-600 text-white hover:bg-red-700",
} as const;

/** 大きさ */
const SIZE_CLASSES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
  /** 送信中か。true の間は押せなくし、文言を loadingText に替える（二重送信を防ぐ） */
  loading?: boolean;
  /** 送信中に出す文言。例: "予約中..." */
  loadingText?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingText,
  disabled,
  // 既定は "button"。HTML の既定（"submit"）のままだと、フォームの中に置いたボタンを押しただけで
  // フォームが送信されてしまうため。送信用のボタンは type="submit" を明示する
  type = "button",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      type={type}
      // 送信中も押せなくする
      disabled={disabled || loading}
      // 送信中であることを画面読み上げにも伝える
      aria-busy={loading || undefined}
      className={[
        "inline-flex items-center justify-center rounded-lg font-semibold transition",
        "focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(" ")}
      {...rest}
    >
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
