import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useCalendar } from "@/features/calendar/hooks";
import type { CalendarResponse } from "@/features/calendar/types";
import { addDays } from "@/lib/date";
import { CALENDAR_POLL_MS } from "@/lib/query-config";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * useCalendar（ブラウザで週ごとの空き状況を取る）のテスト。
 * MSW で GET /api/calendar に答え、呼ばれた from・to を記録して確かめる。
 *
 * 2026-10-05 は月曜。予約できる最終日は 2026-11-06（金）とする。
 */

const CALENDAR_URL = "http://localhost/api/calendar";
const BOOKABLE_UNTIL = "2026-11-06";

/** from〜to の、全部の枠が空きのカレンダーを作る */
function calendarOf(
  from: string,
  to: string,
  bookableUntil = BOOKABLE_UNTIL,
): CalendarResponse {
  const data = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    data.push({
      date,
      closed_reason: null,
      slots: [{ hour: 10, status: "available" as const }],
    });
  }
  return { meta: { today: "2026-10-06", bookable_until: bookableUntil }, data };
}

/**
 * GET /api/calendar に答え、呼ばれた期間（"from〜to"）を記録する。
 * delayFor に指定した from の週は、release() を呼ぶまで返事を止める（読み込み中の状態を確かめるため）。
 */
function respondCalendar(
  options: { bookableUntil?: string; delayFor?: string } = {},
) {
  const requested: string[] = [];
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  server.use(
    http.get(CALENDAR_URL, async ({ request }) => {
      const url = new URL(request.url);
      const from = url.searchParams.get("from") ?? "";
      const to = url.searchParams.get("to") ?? "";
      requested.push(`${from}〜${to}`);

      if (from === options.delayFor) {
        await held;
      }
      return HttpResponse.json(calendarOf(from, to, options.bookableUntil));
    }),
  );

  return { requested, release };
}

function renderCalendar(weekStart: string) {
  const queryClient = createTestQueryClient();
  const rendered = renderHook(({ week }) => useCalendar(week), {
    initialProps: { week: weekStart },
    wrapper: withQueryClient(queryClient),
  });
  return { ...rendered, queryClient };
}

afterEach(() => {
  jest.useRealTimers();
});

it("月曜〜日曜の1週間分を、1回で取る", async () => {
  const { requested } = respondCalendar();

  const { result } = renderCalendar("2026-10-05");

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(requested[0]).toBe("2026-10-05〜2026-10-11");
  expect(result.current.data?.data).toHaveLength(7);
});

it("次の週を先読みする", async () => {
  const { requested } = respondCalendar();

  renderCalendar("2026-10-05");

  await waitFor(() => expect(requested).toContain("2026-10-12〜2026-10-18"));
});

it("予約できる最終日を含む週では、その先の週を先読みしない", async () => {
  // 11/6（金）が最終日。11/2 の週は最終日を含むので表示できるが、次の 11/9 の週には進めない
  const { requested } = respondCalendar();

  const { result } = renderCalendar("2026-11-02");

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  // 先読みが起きるなら起きる時間を少し待ってから、呼ばれていないことを確かめる
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(requested).toEqual(["2026-11-02〜2026-11-08"]);
});

it("週を切り替えている間は、前の週のデータを出したままにする", async () => {
  // 10/19 の週の返事は、release() を呼ぶまで止めておく（10/12 の週は先読みされてしまうので、その次の週で確かめる）
  const { release } = respondCalendar({ delayFor: "2026-10-19" });

  const { result, rerender } = renderCalendar("2026-10-05");
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  rerender({ week: "2026-10-19" });

  // 新しい週の返事が届くまでは、前の週（10/5〜）のデータを「仮のデータ」として返す
  expect(result.current.isPlaceholderData).toBe(true);
  expect(result.current.data?.data[0]?.date).toBe("2026-10-05");

  release();

  await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
  expect(result.current.data?.data[0]?.date).toBe("2026-10-19");
});

it("表示している間は、60秒ごとに取り直す", async () => {
  // 時計を進められるようにする（advanceTimers: true で、MSW などの待ち時間は普段どおり進む）
  jest.useFakeTimers({ advanceTimers: true });
  // 最終日を今週にして、先読みの通信が混ざらないようにする
  const { requested } = respondCalendar({ bookableUntil: "2026-10-11" });

  const { result } = renderCalendar("2026-10-05");
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(requested).toHaveLength(1);

  // 60秒たつと、もう一度取りに行く
  await act(() => jest.advanceTimersByTimeAsync(CALENDAR_POLL_MS));

  await waitFor(() => expect(requested).toHaveLength(2));
  expect(requested[1]).toBe("2026-10-05〜2026-10-11");
});
