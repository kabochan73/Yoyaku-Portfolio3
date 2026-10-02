import "server-only";
import { cookies, headers } from "next/headers";
import { env } from "./env";

/*
 * Server Component からバックエンドの API を呼ぶ（docs/05 の「サーバー側での保護」）。
 *
 * ブラウザからの呼び出し（lib/api-client.ts）と違い、サーバーからの呼び出しには
 * ブラウザの Cookie が自動では付かない。そこで、ブラウザから届いた Cookie をそのまま付けて送る。
 *
 * cookies() を読むので、これを使ったページはアクセスごとに描く作りになる。
 * ログインが必要なページのレイアウトでだけ使う（トップページなど、静的にしたいページでは使わない）。
 */

/**
 * バックエンドの API を呼ぶ。返事はそのまま返すので、状態（status）の判定は呼ぶ側で行う。
 *
 * @param path API の場所（API_URL からの続き）。例: "/user"
 */
export async function serverFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const cookieStore = await cookies();
  const requestHeaders = await headers();

  const outgoing = new Headers(init.headers);
  outgoing.set("Accept", "application/json");
  // ブラウザから届いた Cookie（ログインのセッション）をそのまま渡す
  outgoing.set("Cookie", cookieStore.toString());
  // Sanctum は Referer（か Origin）が SANCTUM_STATEFUL_DOMAINS に入っているときだけ、
  // Cookie のセッションを見る。サーバーからの呼び出しには Referer が無いので、フロントの URL を付ける
  outgoing.set("Referer", env.FRONTEND_URL);
  // 利用者の IP を引き継ぐ（B12）。付けないと、Laravel からは全員が「Next.js サーバーの IP」に見え、
  // IP ごとの回数制限（throttle）を、未ログインの全員で分け合うことになる。
  // Laravel は内部ネットワークから来た X-Forwarded-For だけを信用する（bootstrap/app.php の trustProxies）
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    outgoing.set("X-Forwarded-For", forwardedFor);
  }

  return fetch(`${env.API_URL}${path}`, {
    ...init,
    headers: outgoing,
    // ログインしている人ごとに結果が違うので、Next.js に結果を保存させない
    cache: "no-store",
  });
}
