import "server-only";
import { z } from "zod";

/*
 * サーバー側（Server Component）で使う環境変数（docs/05 の「環境変数」）。
 *
 * zod で形を確かめてから使う。足りない・形が違うときは、このファイルが読み込まれた時点でエラーにする
 * （値が無いまま動いて、よく分からない通信エラーになるのを防ぐ）。
 *
 * "server-only" を付けて、ブラウザ用のコードから import したらビルドで失敗するようにする
 * （内部の URL をブラウザに出さないため。docs/05 の方針6）。
 *
 * ※ next.config.ts も API_URL を確かめているが、あちらは設定ファイルなので、このファイルは使えない。
 */

const schema = z.object({
  /** バックエンドの API の場所（内部の URL）。例: http://nginx/api */
  API_URL: z.url(),
  /** このフロントの URL。サーバーから API を呼ぶときの Referer に使う（lib/server-fetch.ts）。例: http://localhost:3000 */
  FRONTEND_URL: z.url(),
});

export const env = schema.parse({
  API_URL: process.env.API_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
});
