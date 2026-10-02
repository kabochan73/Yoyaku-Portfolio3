import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { AdminCalendar } from "@/features/admin/calendar/components/AdminCalendar";
import type {
  AdminCalendarDay,
  AdminCalendarResponse,
} from "@/features/admin/calendar/types";
import { addDays } from "@/lib/date";
import facilityJson from "@/test/fixtures/facility.json";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * 管理画面の予約カレンダー（AdminCalendar）のテスト（docs/08 の 6.1）。
 *
 * 今を 2026-10-06（火）12:00（日本時間）に固定する。今週は 10/5（月・定休日）〜10/11。
 * 10/5（定休日）の 18〜20時に会員の予約が残っている（B11）。10/7 の 12〜14時は電話予約。
 */

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

const ADMIN_CALENDAR_URL = "http://localhost/api/admin/calendar";

const memberReservation = {
  id: 41,
  date: "2026-10-05",
  start_hour: 18,
  end_hour: 20,
  hours: 2,
  price: 8000,
  status: "confirmed" as const,
  phase: "finished" as const,
  is_cancellable: false,
  booker_name: "山田太郎",
  user_id: 5,
  is_phone: false,
};
const phoneReservation = {
  ...memberReservation,
  id: 42,
  date: "2026-10-07",
  start_hour: 12,
  end_hour: 14,
  phase: "before_start" as const,
  is_cancellable: true,
  booker_name: "電話 佐藤",
  user_id: null,
  is_phone: true,
};

/** from〜to の管理者用カレンダーを作る。before に指定した日より前は、保持期間外（枠が空） */
function adminCalendarOf(
  from: string,
  to: string,
  before = "2026-07-06",
): AdminCalendarResponse {
  const data: AdminCalendarDay[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (date < before) {
      data.push({ date, closed_reason: "past", slots: [], reservations: [] });
      continue;
    }
    const isHoliday = date === "2026-10-05";
    const reservations = [memberReservation, phoneReservation].filter(
      (r) => r.date === date,
    );
    data.push({
      date,
      closed_reason: isHoliday ? "regular_holiday" : null,
      slots: Array.from({ length: 12 }, (_, i) => {
        const hour = 10 + i;
        const reservation = reservations.find(
          (r) => r.start_hour <= hour && hour < r.end_hour,
        );
        return {
          hour,
          status: reservation ? "booked" : isHoliday ? "closed" : "available",
          reservation_id: reservation?.id ?? null,
        };
      }),
      reservations,
    });
  }
  return { meta: { today: "2026-10-06", bookable_until: "2026-11-06" }, data };
}

function renderCalendar(before?: string) {
  server.use(
    http.get("http://localhost/api/facility", () =>
      HttpResponse.json(facilityJson),
    ),
    http.get(ADMIN_CALENDAR_URL, ({ request }) => {
      const url = new URL(request.url);
      return HttpResponse.json(
        adminCalendarOf(
          url.searchParams.get("from") ?? "",
          url.searchParams.get("to") ?? "",
          before,
        ),
      );
    }),
  );
  render(<AdminCalendar />, {
    wrapper: withQueryClient(createTestQueryClient()),
  });
}

/** 枠のボタン。例: slot("10月7日（水）", 14) */
function slot(day: string, hour: number) {
  return screen.getByRole("button", {
    name: new RegExp(`^${day}${hour}:00 〜 ${hour + 1}:00 `),
  });
}

beforeEach(() => {
  jest
    .useFakeTimers({ advanceTimers: true })
    .setSystemTime(new Date("2026-10-06T03:00:00Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

it("予約済みの枠に予約者名（電話予約は ☎）を出し、受付外の日は見出しに理由を出す", async () => {
  renderCalendar();

  expect(await screen.findAllByText("☎ 電話 佐藤")).toHaveLength(2);
  expect(screen.getByText("定休日")).toBeInTheDocument();
});

it("B11: 定休日に残った予約も出て、押すと予約の詳細が開く（開始済みならキャンセルボタンは無い）", async () => {
  renderCalendar();
  await screen.findAllByText("山田太郎");

  await userEvent.click(slot("10月5日（月）", 18));

  const dialog = screen.getByRole("dialog", { name: "予約詳細" });
  expect(within(dialog).getByText("山田太郎")).toBeInTheDocument();
  expect(
    within(dialog).queryByRole("button", { name: "この予約をキャンセル" }),
  ).not.toBeInTheDocument();
});

it("受付外の日の予約が無い枠は押せない", async () => {
  renderCalendar();
  await screen.findAllByText("山田太郎");

  expect(slot("10月5日（月）", 12)).toBeDisabled();
});

it("空きの枠を2つ選ぶと、電話予約のダイアログが開く", async () => {
  renderCalendar();
  await waitFor(() => expect(slot("10月8日（木）", 14)).toBeEnabled());

  await userEvent.click(slot("10月8日（木）", 14));
  await userEvent.click(slot("10月8日（木）", 15));

  const dialog = screen.getByRole("dialog", { name: "電話予約の登録" });
  expect(within(dialog).getByText("2026年10月8日（木）")).toBeInTheDocument();
});

it("次の週には制限なく進める。前の週は、保持期間より前の日が出たら戻れない", async () => {
  // 10/5 の週の月曜より前は保持期間外にする → 10/5 の週は戻れるが、9/28 の週の最初の日は空
  renderCalendar("2026-10-01");
  await screen.findAllByText("山田太郎");

  expect(screen.getByRole("button", { name: "次の週 →" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "← 前の週" })).toBeEnabled();

  await userEvent.click(screen.getByRole("button", { name: "← 前の週" }));
  expect(await screen.findByText("9/28 〜 10/4")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "← 前の週" })).toBeDisabled(),
  );
});
