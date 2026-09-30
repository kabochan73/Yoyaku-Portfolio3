/*
 * 各テストファイルの前に読み込まれる準備（jest.config.ts の setupFilesAfterEnv）。
 */

// expect(要素).toBeInTheDocument() などの、画面を確かめるための書き方を使えるようにする
import "@testing-library/jest-dom";

import { server } from "@/test/msw/server";

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
