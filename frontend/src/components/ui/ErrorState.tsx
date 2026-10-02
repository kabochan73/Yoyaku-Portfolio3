import { Button } from "./Button";

/*
 * 取得に失敗したときの表示（エラー文 + 再読み込みボタン。docs/08 の 1.1）。
 *
 * 【取得の失敗を「データが無い」ように見せない】（B15）
 * R1 はカレンダーの取得に失敗すると、全部の枠が「－」（受付外）になり、
 * 「今週は全部埋まっている / 休み」に見えて、失敗に気づけなかった。
 * 取得に失敗した場所には、必ずこの部品を出す。
 *
 * 使い方: <ErrorState message="空き状況を取得できませんでした" onRetry={() => refetch()} />
 *
 * 状態を持たない部品なので "use client" を付けない（onRetry は呼ぶ側の Client Component が渡す）。
 */

type Props = {
  /** 何が失敗したか。例: "空き状況を取得できませんでした" */
  message: string;
  /** 「再読み込み」を押したときの処理。省略するとボタンを出さない */
  onRetry?: () => void;
  /** ボタンの文言。既定は「再読み込み」 */
  retryLabel?: string;
};

export function ErrorState({
  message,
  onRetry,
  retryLabel = "再読み込み",
}: Props) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white px-6 py-10 text-center"
    >
      <p className="text-sm text-zinc-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
