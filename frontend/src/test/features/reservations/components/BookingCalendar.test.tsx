import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { User } from "@/features/auth/types";
import { FacilityProvider } from "@/features/facility/components/FacilityProvider";
import type { Facility } from "@/features/facility/types";
import type { CalendarResponse, SlotStatus } from "@/features/calendar/types";
import { BookingCalendar } from "@/features/reservations/components/BookingCalendar";
import { addDays } from "@/lib/date";
import { queryKeys } from "@/lib/query-keys";
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
const RESERVATIONS_URL = "http://localhost/api/reservations";
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

/** GET /api/calendar に、期間どおりのカレンダーを返す。呼ばれた回数を数える */
function respondCalendar() {
  const calls = { count: 0 };
  server.use(
    http.get(CALENDAR_URL, ({ request }) => {
      calls.count++;
      const url = new URL(request.url);
      return HttpResponse.json(
        calendarOf(
          url.searchParams.get("from") ?? "",
          url.searchParams.get("to") ?? "",
        ),
      );
    }),
  );
  return calls;
}

const member: User = {
  id: 1,
  name: "山田太郎",
  email: "taro@example.com",
  role: "user",
};

/** カレンダーを描く。ログイン中のユーザーを決めておく（既定は会員） */
function renderCalendar(user: User | null = member) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.user, user);
  render(
    <FacilityProvider facility={facility}>
      <BookingCalendar />
    </FacilityProvider>,
    { wrapper: withQueryClient(queryClient) },
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

it("開始と終了の枠を選ぶと、確認ダイアログに日付・時間・料金を出す", async () => {
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

  const dialog = screen.getByRole("dialog", { name: "予約内容の確認" });
  expect(within(dialog).getByText("2026年10月8日（木）")).toBeInTheDocument();
  expect(within(dialog).getByText("14:00 〜 16:00")).toBeInTheDocument();
  expect(within(dialog).getByText("¥8,000（見積もり）")).toBeInTheDocument();
});

it("確認ダイアログを「戻る」で閉じると、選択も解除する", async () => {
  respondCalendar();
  renderCalendar();
  await waitFor(() => expect(slot("10月8日（木）", 14)).toBeEnabled());

  await userEvent.click(slot("10月8日（木）", 14));
  await userEvent.click(slot("10月8日（木）", 15));
  await userEvent.click(screen.getByRole("button", { name: "戻る" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.getByText("開始時刻の枠を選んでください（2〜4時間）"),
  ).toBeInTheDocument();
});

it("予約できたら、ダイアログを閉じ、完了のメッセージを出し、カレンダーを取り直す", async () => {
  const calendarCalls = respondCalendar();
  server.use(
    http.post(RESERVATIONS_URL, () =>
      HttpResponse.json(
        {
          data: {
            id: 10,
            date: "2026-10-08",
            start_hour: 14,
            end_hour: 16,
            hours: 2,
            price: 8000,
            status: "confirmed",
            phase: "before_start",
            is_cancellable: true,
            booker_name: "山田太郎",
          },
        },
        { status: 201 },
      ),
    ),
  );
  renderCalendar();
  await waitFor(() => expect(slot("10月8日（木）", 14)).toBeEnabled());
  // ここまでの取得の回数（今週 + 次の週の先読み）
  const callsBefore = calendarCalls.count;

  await userEvent.click(slot("10月8日（木）", 14));
  await userEvent.click(slot("10月8日（木）", 15));
  await userEvent.click(screen.getByRole("button", { name: "予約する" }));

  const message = await screen.findByText(
    "予約しました。確認メールをお送りしました。",
  );
  expect(
    screen.getByText("2026年10月8日（木） 14:00 〜 16:00（¥8,000）"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "マイページで確認" }),
  ).toHaveAttribute("href", "/mypage");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  // カーソルは完了のメッセージへ（docs/08 の 1.3）
  expect(message.closest("[tabindex='-1']")).toHaveFocus();
  // 予約の後は、60秒たっていなくても、すぐカレンダーを取り直す
  await waitFor(() => expect(calendarCalls.count).toBeGreaterThan(callsBefore));

  // 次の枠を選び始めたら、完了のメッセージは消す
  await waitFor(() => expect(slot("10月9日（金）", 14)).toBeEnabled());
  await userEvent.click(slot("10月9日（金）", 14));
  expect(
    screen.queryByText("予約しました。確認メールをお送りしました。"),
  ).not.toBeInTheDocument();
});

it("409 slot_taken なら、ダイアログの中にエラーを出し、カレンダーを取り直す", async () => {
  const calendarCalls = respondCalendar();
  server.use(
    http.post(RESERVATIONS_URL, () =>
      HttpResponse.json(
        {
          message: "その時間帯は先に予約されました。別の時間をお選びください。",
          code: "slot_taken",
        },
        { status: 409 },
      ),
    ),
  );
  renderCalendar();
  await waitFor(() => expect(slot("10月8日（木）", 14)).toBeEnabled());
  const callsBefore = calendarCalls.count;

  await userEvent.click(slot("10月8日（木）", 14));
  await userEvent.click(slot("10月8日（木）", 15));
  await userEvent.click(screen.getByRole("button", { name: "予約する" }));

  const dialog = screen.getByRole("dialog", { name: "予約内容の確認" });
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "その時間帯は先に予約されました。",
  );
  await waitFor(() => expect(calendarCalls.count).toBeGreaterThan(callsBefore));
});

it("未ログインなら、確認ダイアログに「ログインして予約」を出す", async () => {
  respondCalendar();
  renderCalendar(null);
  await waitFor(() => expect(slot("10月8日（木）", 14)).toBeEnabled());

  await userEvent.click(slot("10月8日（木）", 14));
  await userEvent.click(slot("10月8日（木）", 15));

  expect(
    screen.getByRole("link", { name: "ログインして予約" }),
  ).toHaveAttribute("href", "/login");
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
