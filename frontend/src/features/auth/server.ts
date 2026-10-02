import "server-only";
import { cache } from "react";
import { serverFetch } from "@/lib/server-fetch";
import type { User } from "./types";

/*
 * Server Component 用の認証の関数（docs/05 の「サーバー側での保護」、D9）。
 * ブラウザ用は api.ts / hooks.ts。
 */

/**
 * ログイン中のユーザーをサーバーで取る。未ログインなら null。
 * ログインが必要なページのレイアウトで、描く前に判定するために使う。
 *
 * - 401（未ログイン）は null。それ以外の失敗（500 など）はエラーにして、エラーの画面（error.tsx）に任せる
 * - React の cache() で包み、1回のリクエストの中で何度呼んでも、API を呼ぶのは1回にする
 *   （レイアウトとページの両方で呼んでも、通信が2回にならない）
 *
 * この判定は「画面の出し分け」のためで、守りではない。守りは API 側の auth:sanctum（docs/05）。
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const response = await serverFetch("/user");

  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(
      `ログイン中のユーザーを取れませんでした（status: ${response.status}）`,
    );
  }

  const body = (await response.json()) as { data: User };
  return body.data;
});
