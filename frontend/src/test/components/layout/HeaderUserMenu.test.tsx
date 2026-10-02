import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { User } from "@/features/auth/types";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";
import { HeaderUserMenu } from "@/components/layout/HeaderUserMenu";

/*
 * ヘッダーの右側のテスト。MSW で GET /api/user の返事を変えて、状態ごとの表示を確かめる。
 */

// useRouter は Next.js のアプリの中でしか動かないので、移動の指示（push）だけを差し替える
const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const USER_URL = "http://localhost/api/user";
const LOGOUT_URL = "http://localhost/api/logout";

const member: User = {
  id: 1,
  name: "山田太郎",
  email: "taro@example.com",
  role: "user",
};
const admin: User = {
  id: 2,
  name: "管理者",
  email: "admin@example.com",
  role: "admin",
};

/** GET /api/user の返事を決める */
function respondUser(user: User | null) {
  server.use(
    http.get(USER_URL, () =>
      user
        ? HttpResponse.json({ data: user })
        : HttpResponse.json(
            {
              message: "ログインしてください。",
              code: "unauthenticated",
              errors: {},
            },
            { status: 401 },
          ),
    ),
  );
}

function renderMenu() {
  return render(<HeaderUserMenu />, {
    wrapper: withQueryClient(createTestQueryClient()),
  });
}

beforeEach(() => {
  push.mockClear();
});

it("読み込み中は、ボタンの代わりにスケルトンを出す", () => {
  respondUser(member);

  const { container } = renderMenu();

  // 最初の描画では、まだ返事が届いていない
  expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("未ログインなら、ログインと新規登録を出す", async () => {
  respondUser(null);

  renderMenu();

  expect(await screen.findByRole("link", { name: "ログイン" })).toHaveAttribute(
    "href",
    "/login",
  );
  expect(screen.getByRole("link", { name: "新規登録" })).toHaveAttribute(
    "href",
    "/register",
  );
  expect(
    screen.queryByRole("button", { name: "ログアウト" }),
  ).not.toBeInTheDocument();
});

it("取得に失敗（500）したら、未ログインと同じ表示にする", async () => {
  server.use(
    http.get(USER_URL, () =>
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

  renderMenu();

  expect(
    await screen.findByRole("link", { name: "ログイン" }),
  ).toBeInTheDocument();
});

it("会員なら、マイページとログアウトを出す", async () => {
  respondUser(member);

  renderMenu();

  expect(
    await screen.findByRole("link", { name: "マイページ" }),
  ).toHaveAttribute("href", "/mypage");
  expect(
    screen.getByRole("button", { name: "ログアウト" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "管理者ページ" }),
  ).not.toBeInTheDocument();
});

it("管理者なら、管理者ページとログアウトを出す", async () => {
  respondUser(admin);

  renderMenu();

  expect(
    await screen.findByRole("link", { name: "管理者ページ" }),
  ).toHaveAttribute("href", "/admin");
  expect(
    screen.queryByRole("link", { name: "マイページ" }),
  ).not.toBeInTheDocument();
});

it("ログアウトすると、未ログインの表示になり、トップへ移動する", async () => {
  respondUser(member);
  server.use(
    http.post(LOGOUT_URL, () => new HttpResponse(null, { status: 204 })),
  );

  renderMenu();
  await userEvent.click(
    await screen.findByRole("button", { name: "ログアウト" }),
  );

  expect(
    await screen.findByRole("link", { name: "ログイン" }),
  ).toBeInTheDocument();
  expect(push).toHaveBeenCalledWith("/");
});

it("ログアウトに失敗したら、alert で知らせ、ログインしたままの表示に戻る", async () => {
  respondUser(member);
  server.use(
    http.post(LOGOUT_URL, () =>
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
  const alert = jest.spyOn(window, "alert").mockImplementation(() => {});

  renderMenu();
  await userEvent.click(
    await screen.findByRole("button", { name: "ログアウト" }),
  );

  expect(alert).toHaveBeenCalledWith("サーバーでエラーが起きました。");
  expect(screen.getByRole("button", { name: "ログアウト" })).toBeEnabled();
  expect(push).not.toHaveBeenCalled();
  alert.mockRestore();
});
