import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  useCancelReservation,
  useCreateReservation,
  useMyReservations,
} from "@/features/reservations/hooks";
import type { Reservation } from "@/features/reservations/types";
import { queryKeys } from "@/lib/query-keys";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * 予約の hook のテスト（docs/05 の「更新後に取り直すデータ」）。
 * 成功・失敗のあとに、どのデータに「古い」と印が付くか（isInvalidated）を確かめる。
 */

const RESERVATIONS_URL = "http://localhost/api/reservations";
const MY_RESERVATIONS_URL = "http://localhost/api/user/reservations";

const reservation: Reservation = {
  id: 1,
  date: "2026-10-07",
  start_hour: 12,
  end_hour: 14,
  hours: 2,
  price: 8000,
  status: "confirmed",
  phase: "before_start",
  is_cancellable: true,
  booker_name: "山田太郎",
};

/** 409 の返事 */
function conflict(code: string) {
  return HttpResponse.json({ message: "409", code }, { status: 409 });
}

/**
 * カレンダー（2つの週）と予約一覧をキャッシュに入れた状態で、hook を動かす。
 * どれに「古い」印が付いたかを、後で見られるようにする。
 */
function renderWithCachedData<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.calendar.week("2026-10-05"), {
    meta: {},
    data: [],
  });
  queryClient.setQueryData(queryKeys.calendar.week("2026-10-12"), {
    meta: {},
    data: [],
  });
  queryClient.setQueryData(queryKeys.myReservations, [reservation]);

  const rendered = renderHook(hook, { wrapper: withQueryClient(queryClient) });

  /** そのキーのデータに「古い」印が付いているか */
  const isInvalidated = (queryKey: readonly unknown[]) =>
    queryClient.getQueryState(queryKey)?.isInvalidated ?? false;

  return { ...rendered, isInvalidated };
}

it("useMyReservations: 自分の予約一覧を取る", async () => {
  server.use(
    http.get(MY_RESERVATIONS_URL, () =>
      HttpResponse.json({ data: [reservation] }),
    ),
  );

  const { result } = renderHook(() => useMyReservations(), {
    wrapper: withQueryClient(createTestQueryClient()),
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual([reservation]);
});

describe("useCreateReservation", () => {
  it("予約できたら、カレンダーの全部の週と予約一覧を取り直させる", async () => {
    let sent: unknown;
    server.use(
      http.post(RESERVATIONS_URL, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ data: reservation }, { status: 201 });
      }),
    );
    const { result, isInvalidated } = renderWithCachedData(() =>
      useCreateReservation(),
    );

    result.current.mutate({ date: "2026-10-07", start_hour: 12, end_hour: 14 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sent).toEqual({ date: "2026-10-07", start_hour: 12, end_hour: 14 });
    expect(isInvalidated(queryKeys.calendar.week("2026-10-05"))).toBe(true);
    expect(isInvalidated(queryKeys.calendar.week("2026-10-12"))).toBe(true);
    expect(isInvalidated(queryKeys.myReservations)).toBe(true);
  });

  it("409 slot_taken なら、カレンダーを取り直させる（埋まった枠をすぐ見せる）", async () => {
    server.use(http.post(RESERVATIONS_URL, () => conflict("slot_taken")));
    const { result, isInvalidated } = renderWithCachedData(() =>
      useCreateReservation(),
    );

    result.current.mutate({ date: "2026-10-07", start_hour: 12, end_hour: 14 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isInvalidated(queryKeys.calendar.week("2026-10-05"))).toBe(true);
    // 予約一覧は変わっていないので、取り直さない
    expect(isInvalidated(queryKeys.myReservations)).toBe(false);
  });

  it("ほかの失敗（409 already_booked_that_day・422 など）では、何も取り直さない", async () => {
    server.use(
      http.post(RESERVATIONS_URL, () => conflict("already_booked_that_day")),
    );
    const { result, isInvalidated } = renderWithCachedData(() =>
      useCreateReservation(),
    );

    result.current.mutate({ date: "2026-10-07", start_hour: 12, end_hour: 14 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isInvalidated(queryKeys.calendar.week("2026-10-05"))).toBe(false);
    expect(isInvalidated(queryKeys.myReservations)).toBe(false);
  });
});

describe("useCancelReservation", () => {
  it("キャンセルできたら、カレンダーと予約一覧を取り直させる", async () => {
    server.use(
      http.post(`${RESERVATIONS_URL}/1/cancel`, () =>
        HttpResponse.json({ data: { ...reservation, status: "cancelled" } }),
      ),
    );
    const { result, isInvalidated } = renderWithCachedData(() =>
      useCancelReservation(),
    );

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(isInvalidated(queryKeys.calendar.week("2026-10-05"))).toBe(true);
    expect(isInvalidated(queryKeys.myReservations)).toBe(true);
  });

  it("409 reservation_not_cancellable なら、予約一覧を取り直させる（今の状態に直す）", async () => {
    server.use(
      http.post(`${RESERVATIONS_URL}/1/cancel`, () =>
        conflict("reservation_not_cancellable"),
      ),
    );
    const { result, isInvalidated } = renderWithCachedData(() =>
      useCancelReservation(),
    );

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isInvalidated(queryKeys.myReservations)).toBe(true);
    expect(isInvalidated(queryKeys.calendar.week("2026-10-05"))).toBe(false);
  });
});
