import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { queryKeys } from "@/lib/query-keys";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";
import type { User } from "@/features/auth/types";
import { LoginForm } from "@/features/auth/components/LoginForm";

/*
 * ログインのフォームのテスト。MSW で POST /api/login の返事を変えて、画面の動きを確かめる。
 */

// useRouter は Next.js のアプリの中でしか動かないので、移動の指示（replace）だけを差し替える
const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const LOGIN_URL = "http://localhost/api/login";
const CSRF_URL = "http://localhost/sanctum/csrf-cookie";

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

function renderForm() {
  const queryClient = createTestQueryClient();
  render(<LoginForm />, { wrapper: withQueryClient(queryClient) });
  return { queryClient };
}

/** メールアドレスとパスワードを入れて送信する */
async function submit(email = "taro@example.com", password = "password") {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText("メールアドレス"), email);
  if (password) await user.type(screen.getByLabelText("パスワード"), password);
  await user.click(screen.getByRole("button", { name: "ログイン" }));
}

beforeEach(() => {
  replace.mockClear();
  server.use(http.get(CSRF_URL, () => new HttpResponse(null, { status: 204 })));
});

it("空のまま送ると、入力欄の下にエラーを出し、送信しない", async () => {
  let called = false;
  server.use(
    http.post(LOGIN_URL, () => {
      called = true;
      return HttpResponse.json({ data: member });
    }),
  );
  renderForm();

  await submit("", "");

  expect(
    await screen.findByText("メールアドレスを入力してください。"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("パスワードを入力してください。"),
  ).toBeInTheDocument();
  // エラー文は入力欄に結びついている（画面読み上げで読まれる）
  expect(screen.getByLabelText("メールアドレス")).toHaveAccessibleDescription(
    "メールアドレスを入力してください。",
  );
  expect(called).toBe(false);
});

it("メールアドレスの形が違うと、入力欄の下にエラーを出す", async () => {
  renderForm();

  await submit("not-an-email");

  expect(
    await screen.findByText("メールアドレスの形式が正しくありません。"),
  ).toBeInTheDocument();
});

it("会員なら、ログインしてトップへ移動する", async () => {
  server.use(http.post(LOGIN_URL, () => HttpResponse.json({ data: member })));
  const { queryClient } = renderForm();

  await submit();

  await screen.findByRole("button", { name: "ログイン中..." });
  expect(replace).toHaveBeenCalledWith("/");
  expect(queryClient.getQueryData(queryKeys.user)).toEqual(member);
});

it("管理者なら、管理画面へ移動する", async () => {
  server.use(http.post(LOGIN_URL, () => HttpResponse.json({ data: admin })));
  renderForm();

  await submit("admin@example.com");

  await screen.findByRole("button", { name: "ログイン中..." });
  expect(replace).toHaveBeenCalledWith("/admin");
});

it("送信中は「ログイン中...」になり、押せない", async () => {
  // 返事をテストの中から返せるようにして、送信中の状態を確かめる
  let respond: () => void = () => {};
  server.use(
    http.post(
      LOGIN_URL,
      () =>
        new Promise<Response>((resolve) => {
          respond = () => resolve(HttpResponse.json({ data: member }));
        }),
    ),
  );
  renderForm();

  await submit();

  expect(
    await screen.findByRole("button", { name: "ログイン中..." }),
  ).toBeDisabled();
  respond();
});

it("メールアドレスかパスワードが違うと、フォームの上にエラーを出す", async () => {
  server.use(
    http.post(LOGIN_URL, () =>
      HttpResponse.json(
        {
          message: "入力内容を確認してください。",
          code: "validation_failed",
          errors: {
            credentials: ["メールアドレスまたはパスワードが正しくありません。"],
          },
        },
        { status: 422 },
      ),
    ),
  );
  renderForm();

  await submit();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "メールアドレスまたはパスワードが正しくありません。",
  );
  // もう一度送れる
  expect(screen.getByRole("button", { name: "ログイン" })).toBeEnabled();
  expect(replace).not.toHaveBeenCalled();
});

it("試行回数が多すぎる（429）と、フォームの上にエラーを出す", async () => {
  server.use(
    http.post(LOGIN_URL, () =>
      HttpResponse.json(
        {
          message: "試行回数が多すぎます。しばらくしてからお試しください。",
          code: "too_many_requests",
          errors: {},
        },
        { status: 429 },
      ),
    ),
  );
  renderForm();

  await submit();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "試行回数が多すぎます。しばらくしてからお試しください。",
  );
});
