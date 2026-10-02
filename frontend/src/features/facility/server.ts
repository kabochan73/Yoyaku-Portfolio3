import "server-only";
import { env } from "@/lib/env";
import type { Facility } from "./types";

/*
 * Server Component 用の施設情報の取得（docs/05 の「施設情報とルール」）。
 * ブラウザ用は手順 5-5 の api.ts / hooks.ts（useFacility）。
 */

/** 保存した施設情報に付ける目印。料金などを変えたら、この目印で作り直させる（5-5 の /internal/revalidate） */
export const FACILITY_TAG = "facility";

/** 作り直すまでの秒数（1時間）。オンデマンドの作り直しが失敗したときなどの保険（B6。docs/05 の「再検証」） */
export const FACILITY_REVALIDATE_SECONDS = 3600;

/**
 * 施設情報を取る。トップページ（静的）・フッター・ページの title で使う。
 *
 * 【保存（キャッシュ）】
 * fetch の結果を Next.js に保存し、何度呼んでも API を呼ぶのは1時間に1回にする。
 * Cookie を読まないので、これを使ったページは静的のまま（docs/05 の「トップは静的」）。
 *
 * 【失敗したら】
 * 仮の値は使わずにエラーにする。ビルド中なら、ビルドが失敗する。
 * R1 はビルド時に API に届かないと仮の料金（4000円など）を焼き込み、後から起動スクリプトで直していた。
 * 間違った料金のページを配るより、ビルドが止まって気づける方がよい。
 * 動いている間の作り直しで失敗したときは、Next.js が前回のページを出し続ける（エラー画面にはならない）。
 */
export async function getFacility(): Promise<Facility> {
  const response = await fetch(`${apiBaseUrl()}/facility`, {
    headers: { Accept: "application/json" },
    next: { tags: [FACILITY_TAG], revalidate: FACILITY_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`施設情報を取れませんでした（status: ${response.status}）`);
  }

  const body = (await response.json()) as { data: Facility };
  return body.data;
}

/**
 * 呼び先の API の場所（docs/05 の「ビルド時の API」）。
 *
 * - next build の中 … BUILD_API_URL（ビルドする環境から届く URL。本番はバックエンドの公開 URL、CI はスタブサーバー）
 * - 動いている間   … API_URL（内部の URL。例: http://nginx/api）
 *
 * ビルドの中で API_URL を使わないのは、本番の API_URL が Railway の内部ネットワークの名前で、
 * ビルドする環境からは届かないため。
 */
function apiBaseUrl(): string {
  // next build の間だけ、Next.js が NEXT_PHASE に "phase-production-build" を入れる
  if (process.env.NEXT_PHASE !== "phase-production-build") {
    return env.API_URL;
  }

  if (!env.BUILD_API_URL) {
    throw new Error(
      "環境変数 BUILD_API_URL が設定されていません。ビルドの中で施設情報を取るのに使います（frontend/.env.example を参照）。",
    );
  }
  return env.BUILD_API_URL;
}
