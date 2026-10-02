import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MyReservationList } from "@/features/reservations/components/MyReservationList";
import type { Reservation } from "@/features/reservations/types";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * マイページの予約一覧（MyReservationList）のテスト（docs/08 の 5.1・5.3）。
 */

// useRouter は Next.js のアプリの中でしか動かないので、移動の指示（replace）だけを差し替える
const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const LIST_URL = "http://localhost/api/user/reservations";

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

function renderList() {
  render(<MyReservationList />, {
    wrapper: withQueryClient(createTestQueryClient()),
  });
}

function errorResponse(status: number) {
  return HttpResponse.json(
    { message: "error", code: "error", errors: {} },
    { status },
  );
}

beforeEach(() => {
  replace.mockClear();
});

it("読み込み中はスケルトン、届いたら予約のカードを出す", async () => {
  server.use(
    http.get(LIST_URL, () => HttpResponse.json({ data: [reservation] })),
  );
  renderList();

  expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  expect(await screen.findByText("2026年10月7日（水）")).toBeInTheDocument();
});

it("予約が無ければ「今後の予約はありません」と、空き状況へのリンクを出す", async () => {
  server.use(http.get(LIST_URL, () => HttpResponse.json({ data: [] })));
  renderList();

  expect(await screen.findByText("今後の予約はありません")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "空き状況を見る" })).toHaveAttribute(
    "href",
    "/#calendar-heading",
  );
});

it("取得に失敗したら、「予約が無い」とは区別して、エラーと再読み込みを出す", async () => {
  server.use(http.get(LIST_URL, () => errorResponse(500)));
  renderList();

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("予約を取得できませんでした");
  expect(screen.queryByText("今後の予約はありません")).not.toBeInTheDocument();

  server.use(
    http.get(LIST_URL, () => HttpResponse.json({ data: [reservation] })),
  );
  await userEvent.click(
    within(alert).getByRole("button", { name: "再読み込み" }),
  );
  expect(await screen.findByText("2026年10月7日（水）")).toBeInTheDocument();
});

it("キャンセルできたら、ダイアログを閉じ、一覧から消え、「予約をキャンセルしました」を出す", async () => {
  let cancelled = false;
  server.use(
    // キャンセルの後に取り直すと、その予約は一覧に無い
    http.get(LIST_URL, () =>
      HttpResponse.json({ data: cancelled ? [] : [reservation] }),
    ),
    http.post("http://localhost/api/reservations/1/cancel", () => {
      cancelled = true;
      return HttpResponse.json({
        data: { ...reservation, status: "cancelled" },
      });
    }),
  );
  renderList();

  await userEvent.click(
    await screen.findByRole("button", { name: /の予約をキャンセル$/ }),
  );
  await userEvent.click(screen.getByRole("button", { name: "キャンセルする" }));

  const message = await screen.findByText("予約をキャンセルしました");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(message.closest("[tabindex='-1']")).toHaveFocus();
  await waitFor(() =>
    expect(screen.getByText("今後の予約はありません")).toBeInTheDocument(),
  );
});

it("セッションが切れていたら（401）、ログイン画面へ移す", async () => {
  server.use(http.get(LIST_URL, () => errorResponse(401)));
  renderList();

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
});
