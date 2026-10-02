import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createQueryClient } from "@/app/providers";

/*
 * テスト用の共通の準備。
 */

/**
 * テスト用の TanStack Query。アプリと同じ設定を土台に、自動のやり直しだけを止める
 * （やり直しを待つと、エラーの表示を確かめるテストが遅くなるため）。
 * テストごとに新しく作り、前のテストのデータが残らないようにする。
 */
export function createTestQueryClient(): QueryClient {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
    mutations: { retry: false },
  });
  return queryClient;
}

/**
 * TanStack Query で包む部品を作る。render や renderHook の wrapper に渡す。
 *
 * 使い方:
 *   const queryClient = createTestQueryClient();
 *   renderHook(() => useCurrentUser(), { wrapper: withQueryClient(queryClient) });
 */
export function withQueryClient(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}
