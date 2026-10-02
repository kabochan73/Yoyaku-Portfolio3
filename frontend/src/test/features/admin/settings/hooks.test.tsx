import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  useUpdatePrices,
  useUpdateRegularHolidays,
} from "@/features/admin/settings/hooks";
import type { Facility } from "@/features/facility/types";
import { queryKeys } from "@/lib/query-keys";
import facilityJson from "@/test/fixtures/facility.json";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * 施設の設定を保存する hook のテスト（docs/05 の「更新後に取り直すデータ」）。
 */

const facility: Facility = facilityJson.data;

function renderWithCachedData<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.facility, facility);
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
  return { ...rendered, queryClient, isInvalidated };
}

it("料金を保存したら、返ってきた施設情報で置き換え、カレンダーを取り直させる", async () => {
  const updated: Facility = {
    ...facility,
    prices: { weekday: 4500, weekend: 6000 },
  };
  let sent: unknown;
  server.use(
    http.put("http://localhost/api/admin/prices", async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json({ data: updated });
    }),
  );
  const { result, queryClient, isInvalidated } = renderWithCachedData(() =>
    useUpdatePrices(),
  );

  result.current.mutate({ weekday: 4500, weekend: 6000 });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(sent).toEqual({ weekday: 4500, weekend: 6000 });
  expect(queryClient.getQueryData(queryKeys.facility)).toEqual(updated);
  // 施設情報は置き換えたので、取り直さない
  expect(isInvalidated(queryKeys.facility)).toBe(false);
  expect(isInvalidated(queryKeys.admin.calendar.week("2026-10-05"))).toBe(true);
  expect(isInvalidated(queryKeys.calendar.week("2026-10-05"))).toBe(true);
});

it("定休日を保存したら、施設情報を置き換える", async () => {
  const updated: Facility = { ...facility, regular_holidays: [0, 3] };
  let sent: unknown;
  server.use(
    http.put(
      "http://localhost/api/admin/regular-holidays",
      async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ data: updated });
      },
    ),
  );
  const { result, queryClient } = renderWithCachedData(() =>
    useUpdateRegularHolidays(),
  );

  result.current.mutate([0, 3]);

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(sent).toEqual({ days: [0, 3] });
  expect(queryClient.getQueryData(queryKeys.facility)).toEqual(updated);
});
