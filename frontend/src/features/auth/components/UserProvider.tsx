"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { queryKeys } from "@/lib/query-keys";
import type { User } from "../types";

/*
 * サーバーで取ったログイン中のユーザーを、ブラウザ側の TanStack Query に先に入れておく部品
 * （docs/05 の「サーバー側での保護」）。
 *
 * ログインが必要なページのレイアウトで、getCurrentUser() の結果を渡して使う:
 *   const user = await getCurrentUser();
 *   if (!user) redirect("/login");
 *   return <UserProvider initialUser={user}>{children}</UserProvider>;
 *
 * 先に入れておくので、ヘッダーやページの useCurrentUser() は GET /api/user を取り直さずに済む
 * （サーバーで取ったばかりのものを、ブラウザでもう一度取ることになるため）。
 */

type Props = {
  /** サーバーで取ったログイン中のユーザー */
  initialUser: User;
  children: ReactNode;
};

export function UserProvider({ initialUser, children }: Props) {
  const queryClient = useQueryClient();

  // 最初の描画のときに1回だけ入れる（useState の初期値の関数は、最初の1回しか呼ばれない）。
  // useEffect で入れると、描画の後になるので、その間 useCurrentUser() が GET /api/user を取りに行ってしまう
  useState(() => {
    queryClient.setQueryData(queryKeys.user, initialUser);
  });

  return children;
}
