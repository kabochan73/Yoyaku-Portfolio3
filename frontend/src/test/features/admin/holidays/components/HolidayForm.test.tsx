import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { HolidayForm } from "@/features/admin/holidays/components/HolidayForm";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * 臨時休業日の追加フォーム（HolidayForm）のテスト（docs/08 の 6.6）。
 * 今を 2026-10-06（日本時間）に固定する。
 */

const HOLIDAYS_URL = "http://localhost/api/admin/holidays";

function renderForm() {
  render(<HolidayForm />, {
    wrapper: withQueryClient(createTestQueryClient()),
  });
}

/** 日付と理由を入れて「休業日を追加」を押す */
async function submit(date: string, reason = "") {
  await userEvent.type(screen.getByLabelText("日付"), date);
  if (reason)
    await userEvent.type(screen.getByLabelText("理由（任意）"), reason);
  await userEvent.click(screen.getByRole("button", { name: "休業日を追加" }));
}

beforeEach(() => {
  jest
    .useFakeTimers({ advanceTimers: true })
    .setSystemTime(new Date("2026-10-06T03:00:00Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

it("日付の欄は今日より前を選べない（min が今日）", () => {
  renderForm();

  expect(screen.getByLabelText("日付")).toHaveAttribute("min", "2026-10-06");
});

it("登録できたら、フォームを空に戻す", async () => {
  let sent: unknown;
  server.use(
    http.post(HOLIDAYS_URL, async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json(
        { data: { id: 1, date: "2026-10-10", reason: "設備点検" } },
        { status: 201 },
      );
    }),
  );
  renderForm();

  await submit("2026-10-10", "設備点検");

  // 登録できると、フォームが空に戻る
  await waitFor(() => expect(screen.getByLabelText("日付")).toHaveValue(""));
  expect(sent).toEqual({
    date: "2026-10-10",
    reason: "設備点検",
    cancel_reservations: false,
  });
  expect(screen.getByLabelText("日付")).toHaveValue("");
});

it("予約がある日なら確認ダイアログを開き、承認したら cancel_reservations: true で送り直す", async () => {
  const sent: unknown[] = [];
  server.use(
    http.post(HOLIDAYS_URL, async ({ request }) => {
      const body = (await request.json()) as { cancel_reservations: boolean };
      sent.push(body);
      return body.cancel_reservations
        ? HttpResponse.json(
            { data: { id: 1, date: "2026-10-10", reason: null } },
            { status: 201 },
          )
        : HttpResponse.json(
            {
              message:
                "この日には2件の予約があります。すべてキャンセルして休業日にしますか？",
              code: "holiday_has_reservations",
              reservation_count: 2,
            },
            { status: 409 },
          );
    }),
  );
  renderForm();

  await submit("2026-10-10");

  const dialog = await screen.findByRole("dialog", {
    name: "この日には予約が2件あります",
  });
  expect(
    within(dialog).getByText(/2件の予約をすべてキャンセルし/),
  ).toBeInTheDocument();

  await userEvent.click(
    within(dialog).getByRole("button", {
      name: "予約をキャンセルして休業日にする",
    }),
  );

  // 送り直しが成功すると、ダイアログが閉じる
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(sent).toEqual([
    { date: "2026-10-10", reason: null, cancel_reservations: false },
    { date: "2026-10-10", reason: null, cancel_reservations: true },
  ]);
});

it("確認ダイアログを「戻る」で閉じると、何も登録しない", async () => {
  let calls = 0;
  server.use(
    http.post(HOLIDAYS_URL, () => {
      calls++;
      return HttpResponse.json(
        {
          message: "x",
          code: "holiday_has_reservations",
          reservation_count: 1,
        },
        { status: 409 },
      );
    }),
  );
  renderForm();

  await submit("2026-10-10");
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("button", { name: "戻る" }));

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(calls).toBe(1);
});

it("すでに休業日なら、日付の欄の下にエラーを出す", async () => {
  server.use(
    http.post(HOLIDAYS_URL, () =>
      HttpResponse.json(
        {
          message: "すでに休業日として登録されています。",
          code: "holiday_already_exists",
        },
        { status: 409 },
      ),
    ),
  );
  renderForm();

  await submit("2026-10-10");

  expect(
    await screen.findByText("すでに休業日として登録されています。"),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("日付")).toHaveAccessibleDescription(
    "すでに休業日として登録されています。",
  );
});

it("日付が空なら、送らずにエラーを出す", async () => {
  renderForm();

  await userEvent.click(screen.getByRole("button", { name: "休業日を追加" }));

  expect(await screen.findByText("日付を選んでください。")).toBeInTheDocument();
});
