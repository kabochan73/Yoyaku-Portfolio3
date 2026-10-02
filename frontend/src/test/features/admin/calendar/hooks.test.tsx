import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  useAdminCalendar,
  useAdminCancelReservation,
  useCreatePhoneReservation,
} from "@/features/admin/calendar/hooks";
import { queryKeys } from "@/lib/query-keys";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * 管理者用のカレンダーの hook のテスト。
 * 取得の期間・先読みと、操作の後に何を取り直すか（docs/05 の表）を確かめる。
 */

const ADMIN_CALENDAR_URL = "http://localhost/api/admin/calendar";
const ADMIN_RESERVATIONS_URL = "http://localhost/api/admin/reservations";

/** キャッシュにカレンダーを入れた状態で hook を動かし、どれに「古い」印が付いたかを見られるようにする */
function renderWithCachedCalendars<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
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

function conflict(code: string) {
  return HttpResponse.json({ message: "409", code }, { status: 409 });
}

it("useAdminCalendar: 月曜〜日曜を取り、次の週も先読みする（上限なし）", async () => {
  const requested: string[] = [];
  server.use(
    http.get(ADMIN_CALENDAR_URL, ({ request }) => {
      const url = new URL(request.url);
      requested.push(
        `${url.searchParams.get("from")}〜${url.searchParams.get("to")}`,
      );
      return HttpResponse.json({
        meta: { today: "2026-10-06", bookable_until: "2026-11-06" },
        data: [],
      });
    }),
  );

  // 予約できる最終日（11/6）より先の週でも、さらに次の週を先読みする
  renderHook(() => useAdminCalendar("2026-11-09"), {
    wrapper: withQueryClient(createTestQueryClient()),
  });

  await waitFor(() =>
    expect(requested).toEqual([
      "2026-11-09〜2026-11-15",
      "2026-11-16〜2026-11-22",
    ]),
  );
});

it("電話予約できたら、管理者用と公開用のカレンダーを取り直させる", async () => {
  let sent: unknown;
  server.use(
    http.post(ADMIN_RESERVATIONS_URL, async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json({ data: { id: 1 } }, { status: 201 });
    }),
  );
  const { result, isInvalidated } = renderWithCachedCalendars(() =>
    useCreatePhoneReservation(),
  );

  result.current.mutate({
    date: "2026-10-07",
    start_hour: 12,
    end_hour: 14,
    booker_name: "電話 佐藤",
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(sent).toEqual({
    date: "2026-10-07",
    start_hour: 12,
    end_hour: 14,
    booker_name: "電話 佐藤",
  });
  expect(isInvalidated(queryKeys.admin.calendar.week("2026-10-05"))).toBe(true);
  expect(isInvalidated(queryKeys.calendar.week("2026-10-05"))).toBe(true);
});

it("電話予約が 409 slot_taken なら、管理者用のカレンダーを取り直させる", async () => {
  server.use(http.post(ADMIN_RESERVATIONS_URL, () => conflict("slot_taken")));
  const { result, isInvalidated } = renderWithCachedCalendars(() =>
    useCreatePhoneReservation(),
  );

  result.current.mutate({
    date: "2026-10-07",
    start_hour: 12,
    end_hour: 14,
    booker_name: "x",
  });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(isInvalidated(queryKeys.admin.calendar.week("2026-10-05"))).toBe(true);
});

it("キャンセルできたら、管理者用と公開用のカレンダーを取り直させる", async () => {
  server.use(
    http.post(`${ADMIN_RESERVATIONS_URL}/5/cancel`, () =>
      HttpResponse.json({ data: { id: 5 } }),
    ),
  );
  const { result, isInvalidated } = renderWithCachedCalendars(() =>
    useAdminCancelReservation(),
  );

  result.current.mutate(5);

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(isInvalidated(queryKeys.admin.calendar.week("2026-10-05"))).toBe(true);
  expect(isInvalidated(queryKeys.calendar.week("2026-10-05"))).toBe(true);
});

it("キャンセルが 409 なら、管理者用のカレンダーを取り直させる", async () => {
  server.use(
    http.post(`${ADMIN_RESERVATIONS_URL}/5/cancel`, () =>
      conflict("reservation_not_cancellable"),
    ),
  );
  const { result, isInvalidated } = renderWithCachedCalendars(() =>
    useAdminCancelReservation(),
  );

  result.current.mutate(5);

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(isInvalidated(queryKeys.admin.calendar.week("2026-10-05"))).toBe(true);
  expect(isInvalidated(queryKeys.calendar.week("2026-10-05"))).toBe(false);
});
