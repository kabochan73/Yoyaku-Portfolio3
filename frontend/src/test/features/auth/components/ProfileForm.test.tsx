import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { ProfileForm } from "@/features/auth/components/ProfileForm";
import type { User } from "@/features/auth/types";
import { queryKeys } from "@/lib/query-keys";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * プロフィール設定のフォーム（ProfileForm）のテスト（docs/08 の 5.4）。
 */

// useRouter は Next.js のアプリの中でしか動かないので、移動の指示（replace）だけを差し替える
const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const PROFILE_URL = "http://localhost/api/user/profile";
const user: User = {
  id: 1,
  name: "山田太郎",
  email: "taro@example.com",
  role: "user",
};

/** ログイン中のユーザーを入れた状態でフォームを描く */
function renderForm() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.user, user);
  render(<ProfileForm />, { wrapper: withQueryClient(queryClient) });
  return { queryClient };
}

async function type(label: string, value: string) {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  if (value) await userEvent.type(input, value);
}

const submit = () =>
  userEvent.click(screen.getByRole("button", { name: "更新する" }));

it("名前・メールは今の値、パスワードの欄は空で始まる", () => {
  renderForm();

  expect(screen.getByLabelText("名前")).toHaveValue("山田太郎");
  expect(screen.getByLabelText("メールアドレス")).toHaveValue(
    "taro@example.com",
  );
  expect(screen.getByLabelText("現在のパスワード")).toHaveValue("");
  expect(screen.getByLabelText("新しいパスワード")).toHaveValue("");
});

it("新しいパスワードを入れたときだけ、長さ・確認用・現在のパスワードを確かめる", async () => {
  let called = false;
  server.use(
    http.put(PROFILE_URL, () => {
      called = true;
      return HttpResponse.json({ data: user });
    }),
  );
  renderForm();

  await type("新しいパスワード", "short");
  await type("新しいパスワード（確認）", "different");
  await submit();

  expect(
    await screen.findByText("パスワードは8文字以上で入力してください。"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("パスワードが確認用と一致しません。"),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      "パスワードを変更するときは、現在のパスワードも入力してください。",
    ),
  ).toBeInTheDocument();
  expect(called).toBe(false);
});

it("更新できたら「更新しました」を出し、パスワードの欄を空に戻し、ログイン中のユーザーも置き換える", async () => {
  let sent: unknown;
  const updated: User = { ...user, name: "山田花子" };
  server.use(
    http.put(PROFILE_URL, async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json({ data: updated });
    }),
  );
  const { queryClient } = renderForm();

  await type("名前", "山田花子");
  await type("現在のパスワード", "password");
  await type("新しいパスワード", "newpassword");
  await type("新しいパスワード（確認）", "newpassword");
  await submit();

  expect(
    await screen.findByText("プロフィールを更新しました"),
  ).toBeInTheDocument();
  expect(sent).toEqual({
    name: "山田花子",
    email: "taro@example.com",
    current_password: "password",
    password: "newpassword",
    password_confirmation: "newpassword",
  });
  expect(screen.getByLabelText("新しいパスワード")).toHaveValue("");
  expect(screen.getByLabelText("現在のパスワード")).toHaveValue("");
  // ヘッダーなども、この新しいユーザーを表示する
  expect(queryClient.getQueryData(queryKeys.user)).toEqual(updated);

  // 次に入力を変えたら、「更新しました」は消す
  await userEvent.type(screen.getByLabelText("名前"), "子");
  expect(
    screen.queryByText("プロフィールを更新しました"),
  ).not.toBeInTheDocument();
});

it("現在のパスワードが違う（422）なら、その欄の下にエラーを出す（R1 は全体のメッセージだった）", async () => {
  server.use(
    http.put(PROFILE_URL, () =>
      HttpResponse.json(
        {
          message: "入力内容を確認してください。",
          code: "validation_failed",
          errors: {
            current_password: ["現在のパスワードが正しくありません。"],
          },
        },
        { status: 422 },
      ),
    ),
  );
  renderForm();

  await type("現在のパスワード", "wrong-password");
  await type("新しいパスワード", "newpassword");
  await type("新しいパスワード（確認）", "newpassword");
  await submit();

  await waitFor(() =>
    expect(
      screen.getByLabelText("現在のパスワード"),
    ).toHaveAccessibleDescription("現在のパスワードが正しくありません。"),
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("送信中は「更新中...」で押せない", async () => {
  server.use(http.put(PROFILE_URL, () => new Promise<Response>(() => {})));
  renderForm();

  await submit();

  expect(
    await screen.findByRole("button", { name: "更新中..." }),
  ).toBeDisabled();
});
