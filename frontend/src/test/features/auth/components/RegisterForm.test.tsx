import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { queryKeys } from "@/lib/query-keys";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";
import type { User } from "@/features/auth/types";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

/*
 * 会員登録のフォームのテスト。MSW で POST /api/register の返事を変えて、画面の動きを確かめる。
 */

// useRouter は Next.js のアプリの中でしか動かないので、移動の指示（replace）だけを差し替える
const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const REGISTER_URL = "http://localhost/api/register";
const CSRF_URL = "http://localhost/sanctum/csrf-cookie";

const created: User = {
  id: 3,
  name: "鈴木花子",
  email: "hanako@example.com",
  role: "user",
};

type Input = {
  name: string;
  email: string;
  password: string;
  confirmation: string;
};

const VALID: Input = {
  name: "鈴木花子",
  email: "hanako@example.com",
  password: "password123",
  confirmation: "password123",
};

function renderForm() {
  const queryClient = createTestQueryClient();
  render(<RegisterForm />, { wrapper: withQueryClient(queryClient) });
  return { queryClient };
}

/** 入力して送信する（空文字の項目は入力しない） */
async function submit(input: Input) {
  const user = userEvent.setup();
  if (input.name) await user.type(screen.getByLabelText("名前"), input.name);
  if (input.email)
    await user.type(screen.getByLabelText("メールアドレス"), input.email);
  if (input.password)
    await user.type(screen.getByLabelText("パスワード"), input.password);
  if (input.confirmation) {
    await user.type(
      screen.getByLabelText("パスワード（確認）"),
      input.confirmation,
    );
  }
  await user.click(screen.getByRole("button", { name: "登録する" }));
}

beforeEach(() => {
  replace.mockClear();
  server.use(http.get(CSRF_URL, () => new HttpResponse(null, { status: 204 })));
});

it("入力の間違いは、それぞれの入力欄の下に出し、送信しない", async () => {
  let called = false;
  server.use(
    http.post(REGISTER_URL, () => {
      called = true;
      return HttpResponse.json({ data: created }, { status: 201 });
    }),
  );
  renderForm();

  await submit({
    name: "あ".repeat(21),
    email: "",
    password: "short",
    confirmation: "different",
  });

  expect(
    await screen.findByText("名前は20文字以内で入力してください。"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("メールアドレスを入力してください。"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("パスワードは8文字以上で入力してください。"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("パスワードが確認用と一致しません。"),
  ).toBeInTheDocument();
  expect(called).toBe(false);
});

it("登録できたら、ログインした状態でトップへ移動する", async () => {
  let sent: unknown;
  server.use(
    http.post(REGISTER_URL, async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json({ data: created }, { status: 201 });
    }),
  );
  const { queryClient } = renderForm();

  await submit(VALID);

  await screen.findByRole("button", { name: "登録中..." });
  expect(sent).toEqual({
    name: "鈴木花子",
    email: "hanako@example.com",
    password: "password123",
    password_confirmation: "password123",
  });
  expect(replace).toHaveBeenCalledWith("/");
  expect(queryClient.getQueryData(queryKeys.user)).toEqual(created);
});

it("サーバーの 422 は、項目ごとに入力欄の下に出す（メールの重複はメール欄の下）", async () => {
  server.use(
    http.post(REGISTER_URL, () =>
      HttpResponse.json(
        {
          message: "入力内容を確認してください。",
          code: "validation_failed",
          errors: {
            email: ["このメールアドレスはすでに使われています。"],
            password: ["パスワードが確認用と一致しません。"],
          },
        },
        { status: 422 },
      ),
    ),
  );
  renderForm();

  await submit(VALID);

  expect(
    await screen.findByText("このメールアドレスはすでに使われています。"),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("メールアドレス")).toHaveAccessibleDescription(
    "このメールアドレスはすでに使われています。",
  );
  // 2件目の項目のエラーも出す（R1 は最初の1件だけだった）
  expect(screen.getByLabelText("パスワード")).toHaveAccessibleDescription(
    "8文字以上 パスワードが確認用と一致しません。",
  );
  // 全部入力欄の下に出せたので、フォームの上には出さない
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});

it("試行回数が多すぎる（429）と、フォームの上にエラーを出す", async () => {
  server.use(
    http.post(REGISTER_URL, () =>
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

  await submit(VALID);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "試行回数が多すぎます。しばらくしてからお試しください。",
  );
});
