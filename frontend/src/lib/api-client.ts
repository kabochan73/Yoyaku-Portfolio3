// ブラウザ専用のファイルの印。Server Component などサーバー側から import すると、ビルドで失敗させる。
// ここの axios はブラウザの Cookie（ログインのセッション・CSRF トークン）が前提なので、
// サーバー側では使えない（サーバー側は lib/server-fetch.ts を使う。4-7）。docs/05 の方針6
import "client-only";

import axios, { type InternalAxiosRequestConfig } from "axios";
import { toApiError } from "./api-error";

/*
 * ブラウザから Laravel の API を呼ぶための axios（docs/05 の「API 呼び出し層」）。
 *
 * 画面の部品や hook は直接これを使わず、各機能の api.ts（features/<機能>/api.ts）を通して呼ぶ。
 * 失敗は必ず ApiError（lib/api-error.ts）になって返る。
 */
export const api = axios.create({
  // 常に同じオリジンの /api を呼ぶ。Next.js の rewrites（next.config.ts）が Laravel へ中継する（D16）。
  // ブラウザから見ると API がフロントと同じオリジンなので、Cookie がそのまま使え、CORS の設定も要らない
  baseURL: "/api",

  // Cookie（ログインのセッション）を送る
  withCredentials: true,

  // Cookie の XSRF-TOKEN を読んで、ヘッダー X-XSRF-TOKEN に付けて送る（Laravel の CSRF の確認に使う）
  withXSRFToken: true,

  // JSON で返してもらう（Laravel はこれを見て、エラーも JSON で返す）
  headers: { Accept: "application/json" },
});

/**
 * ログイン・会員登録の前に呼ぶ。Laravel から CSRF トークンの Cookie（XSRF-TOKEN）を受け取る。
 * これ以降の api のリクエストには、withXSRFToken によってトークンが自動で付く。
 */
export async function getCsrfCookie(): Promise<void> {
  // /sanctum は /api の外にあるので、baseURL を使わずに呼ぶ（これも rewrites で Laravel へ中継される）
  await axios.get("/sanctum/csrf-cookie", { withCredentials: true });
}

/** 419 のときに送り直したかどうかの印を持てる設定 */
type RetriableConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean };

/*
 * レスポンスの後処理。
 *
 * 【419（CSRF トークン切れ）は、取り直して1回だけ送り直す】
 * タブを長く開いたままにすると、セッションと一緒に CSRF トークンも期限が切れる。
 * R1 はこれを扱っておらず、そのまま「予約に失敗しました」になっていた。
 * 2回目も 419 なら、無限に繰り返さずにエラーにする（_csrfRetried の印で判断する）。
 *
 * それ以外の失敗は、すべて ApiError に変換して投げ直す。
 */
api.interceptors.response.use(undefined, async (error: unknown) => {
  if (
    axios.isAxiosError(error) &&
    error.response?.status === 419 &&
    error.config
  ) {
    const config: RetriableConfig = error.config;

    if (!config._csrfRetried) {
      config._csrfRetried = true;
      await getCsrfCookie();

      // 同じリクエストを送り直す。新しい CSRF トークンは、送るときに Cookie から読み直して付く
      return api.request(config);
    }
  }

  throw toApiError(error);
});
