"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api-error";
import { queryKeys } from "@/lib/query-keys";

/*
 * アプリ全体で使う仕組みをまとめて提供する部品。ルートのレイアウト（app/layout.tsx）で全体を包む。
 *
 * 今は TanStack Query だけ。サーバーから取ったデータの保存・取り直し・読み込み中やエラーの状態を任せる
 * （docs/05 の方針2。R1 は送信中・エラーの状態を useState で手書きしていた。D10）。
 */

/**
 * TanStack Query の設定を作る。テストでも同じ設定を土台に使う（src/test/render.tsx）。
 */
export function createQueryClient(): QueryClient {
  /**
   * 【セッション切れ】（docs/05 の「セッション切れ」）
   * どの取得・送信でも、401（未ログイン）が返ったら、保存しているログイン中のユーザーを null にする。
   * ログインしたまま長く開いていてセッションが切れたとき、ヘッダーが「ログイン・新規登録」に変わる。
   * これが無いと、ヘッダーには「マイページ・ログアウト」が出たままになる。
   * ログインが必要なページにいたときに、ログイン画面へ移すのは、そのページの部品が行う（マイページ。6-7）。
   *
   * GET /api/user の 401 はエラーにせず null を返す（features/auth/api.ts）ので、ここには来ない。
   */
  const clearUserOnUnauthorized = (error: Error) => {
    if (error instanceof ApiError && error.status === 401) {
      queryClient.setQueryData(queryKeys.user, null);
    }
  };

  const queryClient: QueryClient = new QueryClient({
    // queryCache・mutationCache の onError は、どの取得（useQuery）・送信（useMutation）が失敗しても呼ばれる
    queryCache: new QueryCache({ onError: clearUserOnUnauthorized }),
    mutationCache: new MutationCache({ onError: clearUserOnUnauthorized }),
    defaultOptions: {
      queries: {
        /*
         * 失敗したときの自動のやり直し。
         * - 4xx（401 未ログイン・404 見つからない など）は、やり直しても結果が変わらないので、やり直さない
         * - 通信の失敗・5xx は、一時的なこともあるので1回だけやり直す
         * 既定（3回）のままだと、エラーの表示が出るまでに時間がかかる
         */
        retry: (failureCount, error) => {
          if (
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
  });

  return queryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  // useState で1回だけ作る（描き直しのたびに作り直すと、保存したデータが消えてしまう）。
  // サーバーで描くときは、リクエストごとに別のものが作られる（他の人のデータと混ざらない）
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
