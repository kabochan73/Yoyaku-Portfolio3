import { setupServer } from "msw/node";

/*
 * テスト用の「偽の API サーバー」（MSW）。
 *
 * テストの中で /api/... への通信が発生すると、MSW が横取りして、ここで決めた JSON を返す。
 * 本物の Laravel には繋がない。
 *
 * R1 は axios そのものをモック（jest.mock("@/lib/axios")）していたため、
 * 「API を呼ぶ関数 → hook → 部品」のつながりを通しで確かめられなかった。
 * 通信の層で横取りすれば、アプリのコードは本番と同じまま動く（docs/06）。
 *
 * 今は横取りする API が無い。手順5（/facility・/calendar）から、ここにハンドラーを足していく。
 * 返す JSON は src/test/fixtures/ に置き、CI のビルド用スタブサーバーと共有する（docs/07）。
 */
export const server = setupServer();
