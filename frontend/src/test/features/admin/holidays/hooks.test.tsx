import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  useCreateHoliday,
  useDeleteHoliday,
  useHolidays,
} from "@/features/admin/holidays/hooks";
import { queryKeys } from "@/lib/query-keys";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * 臨時休業日の hook のテスト（docs/05 の「更新後に取り直すデータ」）。
 */

const HOLIDAYS_URL = "http://localhost/api/admin/holidays";

function renderWithCachedData<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.admin.holidays, []);
  queryClient.setQueryData(queryKeys.admin.calendar.week("2026-10-05"), {
    meta: {},
    data: [],
  });
  queryClient.setQueryData(queryKeys.calendar.week("2026-10-05"), {
    meta: {},
    data: [],
  });
  const rendered = renderHook(hook, { wrapper: withQueryClient(queryClient) });
  const isInvalidated = (queryKey: readonly unknown[]) =>
    queryClient.getQueryState(queryKey)?.isInvalidated ?? false;
  return { ...rendered, isInvalidated };
}

it("useHolidays: 一覧を取る", async () => {
  server.use(
    http.get(HOLIDAYS_URL, () =>
      HttpResponse.json({
        data: [{ id: 1, date: "2026-10-10", reason: "設備点検" }],
      }),
    ),
  );

  const { result } = renderHook(() => useHolidays(), {
    wrapper: withQueryClient(createTestQueryClient()),
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual([
    { id: 1, date: "2026-10-10", reason: "設備点検" },
  ]);
});

it("登録できたら、一覧と2つのカレンダーを取り直させる", async () => {
  server.use(
    http.post(HOLIDAYS_URL, () =>
      HttpResponse.json(
        { data: { id: 1, date: "2026-10-10", reason: null } },
        { status: 201 },
      ),
    ),
  );
  const { result, isInvalidated } = renderWithCachedData(() =>
    useCreateHoliday(),
  );

  result.current.mutate({
    date: "2026-10-10",
    reason: null,
    cancel_reservations: false,
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(isInvalidated(queryKeys.admin.holidays)).toBe(true);
  expect(isInvalidated(queryKeys.admin.calendar.week("2026-10-05"))).toBe(true);
  expect(isInvalidated(queryKeys.calendar.week("2026-10-05"))).toBe(true);
});

it("解除できたら、一覧と2つのカレンダーを取り直させる", async () => {
  server.use(
    http.delete(
      `${HOLIDAYS_URL}/1`,
      () => new HttpResponse(null, { status: 204 }),
    ),
  );
  const { result, isInvalidated } = renderWithCachedData(() =>
    useDeleteHoliday(),
  );

  result.current.mutate(1);

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(isInvalidated(queryKeys.admin.holidays)).toBe(true);
  expect(isInvalidated(queryKeys.calendar.week("2026-10-05"))).toBe(true);
});
