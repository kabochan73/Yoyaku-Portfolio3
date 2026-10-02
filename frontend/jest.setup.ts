/*
 * 各テストファイルの前に読み込まれる準備（jest.config.ts の setupFilesAfterEnv）。
 */

// expect(要素).toBeInTheDocument() などの、画面を確かめるための書き方を使えるようにする
import "@testing-library/jest-dom";

import { server } from "@/test/msw/server";

// 【テスト環境の <dialog> の補い】
// テストの中でブラウザを真似る jsdom は、<dialog> の showModal()・close() を持っていない。
// Dialog 部品（components/ui/Dialog.tsx）が使うので、「open の印を付ける・外す」だけの最小限の代わりを足す。
// 後ろの画面を操作できなくする・フォーカスを中に移す、といったブラウザ本来の動きは再現しない
// （そこはブラウザの機能に任せ、テストでは Dialog 部品が自分で書いた振る舞いを確かめる）。
if (
  typeof HTMLDialogElement !== "undefined" &&
  !HTMLDialogElement.prototype.showModal
) {
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

// テストの前に偽の API サーバーを起動する。
// onUnhandledRequest: "error" … ハンドラーを用意していない API が呼ばれたら、テストを失敗させる。
// （用意し忘れに気づかず、たまたま通ってしまうテストを防ぐ）
// ※ MSW は v2 を使う（2026-09-30 決定）。v3 はこの jsdom のテスト環境で、未処理の通信のエラー時に
//   setImmediate が無いと言って落ちるため。v3 ではこの指定の名前も onUnhandledFrame に変わっている
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

// テストごとに、そのテストの中だけで足したハンドラー（server.use(...)）を取り消す。
// 前のテストの「エラーを返す」設定などが、次のテストに残らないようにする。
afterEach(() => server.resetHandlers());

// すべて終わったら止める
afterAll(() => server.close());
