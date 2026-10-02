"use client";

import { useId, useState, type ReactNode } from "react";

/*
 * 開け閉めできる区切り（アコーディオン。docs/05 の「UI 部品」）。マイページ・管理画面の「プロフィール設定」などで使う。
 *
 * - 見出しのボタンを押すと開く・閉じる。aria-expanded で、開いているかを画面読み上げに伝える
 * - 中身は「開いている間だけ」描く。中の部品がデータを取りに行くのを、開くまで遅らせる（docs/05）。
 *   例: 管理画面の「ユーザー検索」は、開かない限り検索の API を呼ばない
 * - 閉じると中身も消えるので、入力途中の値は残らない（開き直すと最初から）
 *
 * 使い方:
 *   <Accordion title="プロフィール設定"><ProfileForm /></Accordion>
 */

type Props = {
  title: string;
  /** 最初から開いておくか（既定は閉じる） */
  defaultOpen?: boolean;
  children: ReactNode;
};

export function Accordion({ title, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  // ボタンと中身を aria-controls で結ぶための id
  const panelId = useId();

  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between px-5 py-4 text-left font-semibold text-zinc-900 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none"
        >
          {title}
          {/* 開いているときは向きを変える（飾りなので読み上げない） */}
          <span
            aria-hidden="true"
            className={`text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▸
          </span>
        </button>
      </h2>
      {open && (
        <div id={panelId} className="border-t border-zinc-200 px-5 py-4">
          {children}
        </div>
      )}
    </section>
  );
}
