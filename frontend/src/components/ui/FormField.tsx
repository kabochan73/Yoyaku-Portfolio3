import type { ReactNode } from "react";

/*
 * フォームの1項目（ラベル・入力欄・エラー文）のまとまり（docs/05 の「UI 部品」・docs/08 の 4）。
 *
 * 【ラベルと入力欄を結びつける】
 * R1 は <label> と <input> が結びついておらず、ラベルを押しても入力欄に移らなかった。
 * また画面読み上げで、入力欄が何の欄か伝わらなかった。
 * ここでは htmlFor と id で結び、エラー文も aria-describedby で入力欄に結びつける。
 *
 * 使い方（入力欄は関数で受け取り、結びつけに必要な属性を渡す）:
 *   <FormField id="login-email" label="メールアドレス" error={errors.email?.message}>
 *     {(control) => <input type="email" {...control} {...register("email")} />}
 *   </FormField>
 *
 * 状態を持たない部品なので "use client" を付けない（入力欄は呼ぶ側の Client Component が作る）。
 */

/** 入力欄に付ける属性。FormField が用意して、children の関数に渡す */
export type FormControlProps = {
  id: string;
  /** エラーがあるとき true。画面読み上げに「入力に誤りがある」と伝える */
  "aria-invalid": boolean;
  /** エラー文・補足の id。画面読み上げが入力欄の説明として読む */
  "aria-describedby"?: string;
  className: string;
};

type Props = {
  /** 入力欄の id。同じ画面の中で重ならない値にする（例: "login-email"） */
  id: string;
  label: string;
  /** エラー文（あれば入力欄の下に赤く出す） */
  error?: string;
  /** 入力欄の下に出す補足（例: "8文字以上"） */
  hint?: string;
  children: (control: FormControlProps) => ReactNode;
};

export function FormField({ id, label, error, hint, children }: Props) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  // 説明として結びつける要素の id（補足とエラーの両方があれば両方）
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-zinc-700"
      >
        {label}
      </label>

      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
        className: [
          "w-full rounded-lg border px-4 py-2.5 text-sm",
          "focus:border-transparent focus:ring-2 focus:ring-green-600 focus:outline-none",
          // エラーがあれば枠を赤くする
          error ? "border-red-400" : "border-zinc-300",
        ].join(" "),
      })}

      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-zinc-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
