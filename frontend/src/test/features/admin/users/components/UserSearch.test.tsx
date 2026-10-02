import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { UserSearch } from "@/features/admin/users/components/UserSearch";
import type { AdminUser } from "@/features/admin/users/types";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * 会員検索（UserSearch）のテスト（docs/08 の 6.7）。
 * 300ms 待ってから検索するので、時計を自分で進める。
 */

const USERS_URL = "http://localhost/api/admin/users";

const taro: AdminUser = {
  id: 1,
  name: "山田太郎",
  email: "taro@example.com",
  confirmed_reservations_count: 3,
};

/** 検索語ごとの返事を決め、呼ばれた検索語を記録する */
function respondUsers(usersFor: (search: string) => AdminUser[]) {
  const searched: string[] = [];
  server.use(
    http.get(USERS_URL, ({ request }) => {
      const search = new URL(request.url).searchParams.get("search") ?? "";
      searched.push(search);
      return HttpResponse.json({ data: usersFor(search), meta: { limit: 20 } });
    }),
  );
  return searched;
}

function renderSearch() {
  render(<UserSearch />, { wrapper: withQueryClient(createTestQueryClient()) });
}

/** 文字を打つ（時計を止めているので、userEvent にも時計を進めさせる） */
async function typeSearch(text: string) {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await user.type(screen.getByLabelText("名前またはメールアドレス"), text);
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it("未入力なら案内を出し、検索しない", () => {
  const searched = respondUsers(() => []);
  renderSearch();

  expect(
    screen.getByText("名前またはメールアドレスで検索できます"),
  ).toBeInTheDocument();
  expect(searched).toEqual([]);
});

it("打ち終えて 300ms たってから、1回だけ検索し、結果を表に出す", async () => {
  const searched = respondUsers(() => [taro]);
  renderSearch();

  await typeSearch("山田");
  // まだ 300ms たっていない
  expect(searched).toEqual([]);

  await act(() => jest.advanceTimersByTimeAsync(300));

  const row = (await screen.findByText("山田太郎")).closest("tr");
  expect(row).not.toBeNull();
  expect(
    within(row as HTMLElement).getByText("taro@example.com"),
  ).toBeInTheDocument();
  expect(within(row as HTMLElement).getByText("3件")).toBeInTheDocument();
  // 1文字ずつではなく、打ち終えた「山田」で1回だけ
  expect(searched).toEqual(["山田"]);
});

it("該当者がいなければ「該当するユーザーはいません」", async () => {
  respondUsers(() => []);
  renderSearch();

  await typeSearch("zzz");
  await act(() => jest.advanceTimersByTimeAsync(300));

  expect(
    await screen.findByText("該当するユーザーはいません"),
  ).toBeInTheDocument();
});

it("20件ちょうどなら「上位20件を表示しています」と出す", async () => {
  respondUsers(() =>
    Array.from({ length: 20 }, (_, i) => ({
      ...taro,
      id: i + 1,
      name: `会員${i + 1}`,
    })),
  );
  renderSearch();

  await typeSearch("会員");
  await act(() => jest.advanceTimersByTimeAsync(300));

  expect(
    await screen.findByText("上位20件を表示しています。条件を絞ってください"),
  ).toBeInTheDocument();
});

it("失敗したら「検索できませんでした」と「再試行」を出す", async () => {
  server.use(
    http.get(USERS_URL, () =>
      HttpResponse.json(
        { message: "error", code: "server_error", errors: {} },
        { status: 500 },
      ),
    ),
  );
  renderSearch();

  await typeSearch("山田");
  await act(() => jest.advanceTimersByTimeAsync(300));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("検索できませんでした");
  expect(
    within(alert).getByRole("button", { name: "再試行" }),
  ).toBeInTheDocument();
});
