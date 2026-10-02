import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { User } from "@/features/auth/types";
import {
  useCreateReservation,
  useMyReservations,
} from "@/features/reservations/hooks";
import { queryKeys } from "@/lib/query-keys";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * createQueryClient（app/providers.tsx）のセッション切れの処理のテスト（docs/05 の「セッション切れ」）。
 * どの取得・送信でも 401 が返ったら、保存しているログイン中のユーザーを null にする。
 */

const MY_RESERVATIONS_URL = "http://localhost/api/user/reservations";
const RESERVATIONS_URL = "http://localhost/api/reservations";

const user: User = {
  id: 1,
  name: "山田太郎",
  email: "taro@example.com",
  role: "user",
};

function errorResponse(status: number) {
  return HttpResponse.json(
    { message: "error", code: "error", errors: {} },
    { status },
  );
}

/** ログイン中のユーザーを保存した状態で、hook を動かす */
function renderLoggedIn<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.user, user);
  const rendered = renderHook(hook, { wrapper: withQueryClient(queryClient) });
  return { ...rendered, queryClient };
}

it("取得（useQuery）で 401 が返ったら、ログイン中のユーザーを null にする", async () => {
  server.use(http.get(MY_RESERVATIONS_URL, () => errorResponse(401)));

  const { result, queryClient } = renderLoggedIn(() => useMyReservations());

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(queryClient.getQueryData(queryKeys.user)).toBeNull();
});

it("送信（useMutation）で 401 が返ったら、ログイン中のユーザーを null にする", async () => {
  server.use(http.post(RESERVATIONS_URL, () => errorResponse(401)));

  const { result, queryClient } = renderLoggedIn(() => useCreateReservation());
  result.current.mutate({ date: "2026-10-07", start_hour: 12, end_hour: 14 });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(queryClient.getQueryData(queryKeys.user)).toBeNull();
});

it("401 以外のエラー（500 など）では、ユーザーをそのままにする", async () => {
  server.use(http.get(MY_RESERVATIONS_URL, () => errorResponse(500)));

  const { result, queryClient } = renderLoggedIn(() => useMyReservations());

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(queryClient.getQueryData(queryKeys.user)).toEqual(user);
});
