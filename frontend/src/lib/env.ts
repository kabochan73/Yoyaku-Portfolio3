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
  /**
   * ビルド（next build）の中で施設情報を取りに行く API の場所。例: http://localhost:8000/api
   * ビルドする環境から「届く」URL にする（本番はバックエンドの公開 URL、CI はスタブサーバー）。
   * 動いている間は使わないので、ここでは省略可にし、ビルドのときだけ必須にする
   * （features/facility/server.ts の apiBaseUrl()。docs/05 の「ビルド時の API」）
   */
  BUILD_API_URL: z.url().optional(),
  /**
   * 作り直しの受け口（POST /internal/revalidate）の合言葉。バックエンドの FRONTEND_REVALIDATE_SECRET と同じ値。
   * 未設定のときは、受け口がすべての呼び出しを 401 で断る（合言葉なしで作り直させない）
   */
  REVALIDATE_SECRET: z.string().min(1).optional(),
});

export const env = schema.parse({
  API_URL: process.env.API_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
  BUILD_API_URL: process.env.BUILD_API_URL,
  REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
});
