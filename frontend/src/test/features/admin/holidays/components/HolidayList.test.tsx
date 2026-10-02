import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { HolidayList } from "@/features/admin/holidays/components/HolidayList";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * 臨時休業日の一覧（HolidayList）のテスト（docs/08 の 6.6）。
 */

const HOLIDAYS_URL = "http://localhost/api/admin/holidays";

function renderList() {
  render(<HolidayList />, {
    wrapper: withQueryClient(createTestQueryClient()),
  });
}

it("休業日を日付（曜日付き）と理由で並べる", async () => {
  server.use(
    http.get(HOLIDAYS_URL, () =>
      HttpResponse.json({
        data: [
          { id: 1, date: "2026-10-10", reason: "設備点検" },
          { id: 2, date: "2026-10-20", reason: null },
        ],
      }),
    ),
  );
  renderList();

  expect(await screen.findByText("2026年10月10日（土）")).toBeInTheDocument();
  expect(screen.getByText("— 設備点検")).toBeInTheDocument();
  expect(screen.getByText("2026年10月20日（火）")).toBeInTheDocument();
});

it("無ければ「登録された休業日はありません」", async () => {
  server.use(http.get(HOLIDAYS_URL, () => HttpResponse.json({ data: [] })));
  renderList();

  expect(
    await screen.findByText("登録された休業日はありません"),
  ).toBeInTheDocument();
});

it("「削除」は確認のダイアログを挟み、「解除する」で消す（R1 は1回で消えた）", async () => {
  let holidays = [{ id: 1, date: "2026-10-10", reason: "設備点検" }];
  let deleted = false;
  server.use(
    http.get(HOLIDAYS_URL, () => HttpResponse.json({ data: holidays })),
    http.delete(`${HOLIDAYS_URL}/1`, () => {
      deleted = true;
      holidays = [];
      return new HttpResponse(null, { status: 204 });
    }),
  );
  renderList();

  await userEvent.click(
    await screen.findByRole("button", {
      name: "2026年10月10日（土） の休業日を削除",
    }),
  );

  // まだ消していない
  const dialog = screen.getByRole("dialog", { name: "休業日を解除しますか？" });
  expect(
    within(dialog).getByText(/キャンセルした予約は元に戻りません/),
  ).toBeInTheDocument();
  expect(deleted).toBe(false);

  await userEvent.click(
    within(dialog).getByRole("button", { name: "解除する" }),
  );

  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(deleted).toBe(true);
  expect(
    await screen.findByText("登録された休業日はありません"),
  ).toBeInTheDocument();
});

it("取得に失敗したら、エラーと再読み込みを出す", async () => {
  server.use(
    http.get(HOLIDAYS_URL, () =>
      HttpResponse.json(
        { message: "error", code: "server_error", errors: {} },
        { status: 500 },
      ),
    ),
  );
  renderList();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "休業日を取得できませんでした",
  );
});
