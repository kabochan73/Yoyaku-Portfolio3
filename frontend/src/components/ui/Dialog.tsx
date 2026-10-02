"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/*
 * ダイアログ（モーダル）。予約の確認・キャンセルの確認・電話予約などで使う（docs/08 の 1.3）。
 *
 * 【D11】R1 はモーダルごとに <div class="fixed …"> を自作していて、
 * 開いてもフォーカスが中に移らず、Esc でも閉じず、後ろの画面も操作できてしまった。
 * R2 はブラウザ組み込みの <dialog> と showModal() を使い、次の振る舞いをブラウザに任せる:
 *   - 開いている間、後ろの画面を操作できない（後ろは「inert」= 押せない・フォーカスできない状態になる）
 *   - 開いたら、中の最初の操作できる要素にフォーカスが移る（autoFocus を付けた要素があればそこ）
 *
 * この部品が自分で行うのは次のこと:
 *   - Esc・背景のクリックで onClose を呼ぶ。ただし送信中（busy）は閉じない（送信の結果を見失わないため）
 *   - 閉じたら、開く前にフォーカスがあった場所へ戻す（ブラウザによって動きが違うので、自分で戻す）
 *   - 開いている間、後ろの画面がスクロールしないようにする
 *
 * 開いているかどうかは、呼ぶ側の状態（open）が決める。ブラウザが勝手に閉じることはさせない。
 *
 * 使い方:
 *   <Dialog open={open} onClose={() => setOpen(false)} title="予約内容の確認" busy={isPending}>
 *     …中身…
 *   </Dialog>
 */

type Props = {
  /** 開いているか。呼ぶ側の状態で決める */
  open: boolean;
  /** 閉じたいとき（Esc・背景のクリック）に呼ばれる。呼ぶ側で open を false にする */
  onClose: () => void;
  /** 見出し。画面読み上げにも、このダイアログの名前として伝わる */
  title: string;
  /** 送信中か。true の間は Esc・背景のクリックで閉じない */
  busy?: boolean;
  children: ReactNode;
};

export function Dialog({
  open,
  onClose,
  title,
  busy = false,
  children,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // 見出しの id。ダイアログと aria-labelledby で結びつける（同じ画面に複数あっても重ならない id）
  const titleId = useId();

  // open が true になったら開き、false になったら（または画面から消えたら）閉じる
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) {
      return;
    }

    // 開く前にフォーカスがあった場所（多くは、ダイアログを開いたボタン）を覚えておく
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    dialog.showModal();

    // 後ろの画面のスクロールを止める（元の値を覚えておき、閉じたら戻す）
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 閉じるとき（open が false になった・画面から消えた）の後片付け
    return () => {
      if (dialog.open) {
        dialog.close();
      }
      document.body.style.overflow = previousOverflow;

      // 開く前の場所へフォーカスを戻す。その要素が消えていたり、押せなくなっていたりしたら戻さない。
      // （例: キャンセルした予約の行のボタンは消える。そのときは呼ぶ側が、成功メッセージなどへ移す。docs/08 の 1.3）
      if (
        previouslyFocused?.isConnected &&
        !previouslyFocused.hasAttribute("disabled")
      ) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      // Esc を押すと、ブラウザが cancel イベントを出す。ブラウザに閉じさせず（preventDefault）、
      // 呼ぶ側に「閉じたい」と伝える。送信中は無視する
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onClose();
        }
      }}
      // 背景（ダイアログの外側の暗い部分）を押すと、クリックの対象が <dialog> 自身になる。
      // 中身を押したときは、中の要素が対象になるので閉じない
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl p-0 shadow-xl backdrop:bg-black/50"
    >
      {/* 中身は開いている間だけ描く（閉じている間に古い内容が残らないように） */}
      {open && (
        <div className="p-6">
          <h2 id={titleId} className="mb-4 text-lg font-bold text-zinc-900">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
