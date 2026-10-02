import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { FacilityProvider } from "@/features/facility/components/FacilityProvider";
import type { Facility } from "@/features/facility/types";
import type { CalendarResponse, SlotStatus } from "@/features/calendar/types";
import { BookingCalendar } from "@/features/reservations/components/BookingCalendar";
import { addDays } from "@/lib/date";
import facilityJson from "@/test/fixtures/facility.json";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * トップの週間カレンダー（BookingCalendar）のテスト（docs/06・docs/08 の 3）。
 *
 * 今を 2026-10-06（火）12:00（日本時間）に固定する。今週は 10/5（月）〜10/11（日）。
 * 予約できる最終日は 2026-11-06（金）とする。月曜は定休日。
 * 10/7（水）の 12・13時を予約済みにしておく。
 */

const CALENDAR_URL = "http://localhost/api/calendar";
const facility: Facility = facilityJson.data;

/** from〜to のカレンダーの返事を作る */
function calendarOf(from: string, to: string): CalendarResponse {
  const data = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const isMonday = new Date(`${date}T00:00:00Z`).getUTCDay() === 1;
    const closed =
      date < "2026-10-06" ? "past" : isMonday ? "regular_holiday" : null;
    data.push({
      date,
      closed_reason: closed,
      slots:
        closed === null
          ? Array.from({ length: 12 }, (_, i) => {
              const hour = 10 + i;
              const status: SlotStatus =
                date === "2026-10-07" && (hour === 12 || hour === 13)
                  ? "booked"
                  : date === "2026-10-06" && hour <= 12
                    ? "past"
                    : "available";
              return { hour, status };
            })
          : [],
    } as const);
  }
  return { meta: { today: "2026-10-06", bookable_until: "2026-11-06" }, data };
}

/** GET /api/calendar に、期間どおりのカレンダーを返す */
function respondCalendar() {
  server.use(
    http.get(CALENDAR_URL, ({ request }) => {
      const url = new URL(request.url);
      return HttpResponse.json(
        calendarOf(
          url.searchParams.get("from") ?? "",
          url.searchParams.get("to") ?? "",
        ),
      );
    }),
  );
}

function renderCalendar() {
  render(
    <FacilityProvider facility={facility}>
      <BookingCalendar />
    </FacilityProvider>,
    { wrapper: withQueryClient(createTestQueryClient()) },
  );
}

/** 枠のボタン。例: slot("10月7日（水）", 14) */
function slot(day: string, hour: number) {
  return screen.getByRole("button", {
    name: new RegExp(`^${day}${hour}:00 〜 ${hour + 1}:00 `),
  });
}

beforeEach(() => {
  // 日本時間 2026-10-06 12:00 = UTC 03:00
  jest
    .useFakeTimers({ advanceTimers: true })
    .setSystemTime(new Date("2026-10-06T03:00:00Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

it("今週（10/5〜10/11）の空き状況を出す", async () => {
  respondCalendar();
  renderCalendar();

  expect(await screen.findByText("10/5 〜 10/11")).toBeInTheDocument();
  await waitFor(() => expect(slot("10月7日（水）", 14)).toBeEnabled());

  expect(slot("10月7日（水）", 12)).toHaveAccessibleName(
    "10月7日（水）12:00 〜 13:00 予約済み",
  );
  expect(slot("10月7日（水）", 12)).toBeDisabled();
  // 今日の始まった枠・定休日（月曜）の枠は押せない
  expect(slot("10月6日（火）", 11)).toBeDisabled();
  expect(slot("10月5日（月）", 14)).toBeDisabled();
  expect(
    screen.getByText("開始時刻の枠を選んでください（2〜4時間）"),
  ).toBeInTheDocument();
});

it("B15: 取得に失敗したら、全部「－」にせず、エラーと再読み込みボタンを出す", async () => {
  server.use(
    http.get(CALENDAR_URL, () =>
      HttpResponse.json(
        {
          message: "サーバーでエラーが起きました。",
          code: "server_error",
          errors: {},
        },
        { status: 500 },
      ),
    ),
  );
  renderCalendar();

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("空き状況を取得できませんでした");
  expect(
    screen.queryByRole("button", { name: /受付外/ }),
  ).not.toBeInTheDocument();

  // 直ったら、再読み込みで出せる
  respondCalendar();
  await userEvent.click(
    within(alert).getByRole("button", { name: "再読み込み" }),
  );

  await waitFor(() => expect(slot("10月7日（水）", 14)).toBeEnabled());
});

it("開始と終了の枠を選ぶと、選んだ内容を案内に出す", async () => {
  respondCalendar();
  renderCalendar();
  await waitFor(() => expect(slot("10月8日（木）", 14)).toBeEnabled());

  await userEvent.click(slot("10月8日（木）", 14));
  expect(
    screen.getByText(
      "終了時刻の枠を選んでください。14:00 から2〜4時間まで選べます",
    ),
  ).toBeInTheDocument();

  await userEvent.click(slot("10月8日（木）", 15));
  expect(
    screen.getByText("2026年10月8日（木） 14:00 〜 16:00（2時間）を選択中"),
  ).toBeInTheDocument();
});

it("今週より前には戻れない。次の週に進むと、表示が変わり、選択は解除される", async () => {
  respondCalendar();
  renderCalendar();
  await waitFor(() => expect(slot("10月8日（木）", 14)).toBeEnabled());

  expect(screen.getByRole("button", { name: "← 前の週" })).toBeDisabled();

  await userEvent.click(slot("10月8日（木）", 14));
  await userEvent.click(screen.getByRole("button", { name: "次の週 →" }));

  expect(await screen.findByText("10/12 〜 10/18")).toBeInTheDocument();
  await waitFor(() => expect(slot("10月13日（火）", 10)).toBeEnabled());
  expect(
    screen.getByText("開始時刻の枠を選んでください（2〜4時間）"),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "← 前の週" })).toBeEnabled();
});

it("予約できる最終日（11/6）を含む週より先には進めない（B13）", async () => {
  respondCalendar();
  renderCalendar();
  await waitFor(() => expect(slot("10月8日（木）", 14)).toBeEnabled());

  // 10/5 → 10/12 → 10/19 → 10/26 → 11/2（11/6 を含む週）
  for (const label of [
    "10/12 〜 10/18",
    "10/19 〜 10/25",
    "10/26 〜 11/1",
    "11/2 〜 11/8",
  ]) {
    await userEvent.click(screen.getByRole("button", { name: "次の週 →" }));
    expect(await screen.findByText(label)).toBeInTheDocument();
  }

  await waitFor(() =>
    expect(screen.getByRole("button", { name: "次の週 →" })).toBeDisabled(),
  );
});
