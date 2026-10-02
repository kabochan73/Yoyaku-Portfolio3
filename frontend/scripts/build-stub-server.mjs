/*
 * ビルド用のスタブサーバー（docs/07 の「ビルド用のスタブサーバー」）。
 *
 * トップページは静的ページで、next build の中で GET /api/facility を呼ぶ（src/features/facility/server.ts）。
 * CI（手順8）にはバックエンドが無いので、決まった施設情報を返すこの小さなサーバーを代わりに立てる。
 *
 * 使い方:
 *   npm run stub                                        # http://localhost:4010 で起動
 *   BUILD_API_URL=http://localhost:4010/api npm run build
 *
 * - 返す JSON は MSW のテストと同じ src/test/fixtures/facility.json（テストとビルドでデータを二重に持たない）
 * - 依存パッケージは使わない（Node.js 標準の http だけ。CI で npm ci の前でも動く）
 * - GET /api/facility 以外は 404
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 4010);

const facilityJson = readFileSync(
  new URL("../src/test/fixtures/facility.json", import.meta.url),
  "utf8",
);

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/api/facility") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(facilityJson);
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(
    JSON.stringify({
      message: "stub: not found",
      code: "not_found",
      errors: {},
    }),
  );
});

server.listen(PORT, () => {
  console.log(`build stub server: http://localhost:${PORT}/api/facility`);
});
