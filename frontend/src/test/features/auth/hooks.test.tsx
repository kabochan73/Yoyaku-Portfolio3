import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { ApiError } from "@/lib/api-error";
import { queryKeys } from "@/lib/query-keys";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";
import { useCurrentUser, useLogin, useLogout } from "@/features/auth/hooks";
import type { User } from "@/features/auth/types";

/*
 * 認証の hook のテスト。MSW で API の返事を決めて、hook が返すものと、保存されるデータを確かめる。
 */

const USER_URL = "http://localhost/api/user";
const LOGIN_URL = "http://localhost/api/login";
const LOGOUT_URL = "http://localhost/api/logout";
const CSRF_URL = "http://localhost/sanctum/csrf-cookie";

const user: User = {
  id: 1,
  name: "山田太郎",
  email: "taro@example.com",
  role: "user",
};

/** hook を、テスト用の TanStack Query で包んで動かす */
function renderWithQuery<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  const rendered = renderHook(hook, { wrapper: withQueryClient(queryClient) });
  return { ...rendered, queryClient };
}

describe("useCurrentUser", () => {
  it("ログイン中なら、ユーザーが返る", async () => {
    server.use(http.get(USER_URL, () => HttpResponse.json({ data: user })));

    const { result } = renderWithQuery(() => useCurrentUser());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(user);
  });

  it("未ログイン（401）なら、エラーではなく null が返る", async () => {
    server.use(
      http.get(USER_URL, () =>
        HttpResponse.json(
          {
            message: "ログインしてください。",
            code: "unauthenticated",
            errors: {},
          },
          { status: 401 },
        ),
      ),
    );

    const { result } = renderWithQuery(() => useCurrentUser());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("サーバーのエラー（500）なら、エラーになる", async () => {
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

    const { result } = renderWithQuery(() => useCurrentUser());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).status).toBe(500);
  });
});

describe("useLogin", () => {
  it("CSRF Cookie を受け取ってからログインし、ユーザーが保存される", async () => {
    // 呼ばれた順番を記録する
    const calls: string[] = [];
    server.use(
      http.get(CSRF_URL, () => {
        calls.push("csrf");
        return new HttpResponse(null, { status: 204 });
      }),
      http.post(LOGIN_URL, async ({ request }) => {
        calls.push("login");
        expect(await request.json()).toEqual({
          email: "taro@example.com",
          password: "password",
        });
        return HttpResponse.json({ data: user });
      }),
    );

    const { result, queryClient } = renderWithQuery(() => useLogin());
    result.current.mutate({ email: "taro@example.com", password: "password" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls).toEqual(["csrf", "login"]);
    // 取り直さなくても、ログイン中のユーザーが入っている
    expect(queryClient.getQueryData(queryKeys.user)).toEqual(user);
  });

  it("メールアドレスかパスワードが違うと、credentials のエラーになる", async () => {
    server.use(
      http.get(CSRF_URL, () => new HttpResponse(null, { status: 204 })),
      http.post(LOGIN_URL, () =>
        HttpResponse.json(
          {
            message: "入力内容を確認してください。",
            code: "validation_failed",
            errors: {
              credentials: [
                "メールアドレスまたはパスワードが正しくありません。",
              ],
            },
          },
          { status: 422 },
        ),
      ),
    );

    const { result, queryClient } = renderWithQuery(() => useLogin());
    result.current.mutate({ email: "taro@example.com", password: "wrong" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.fieldErrors.credentials).toEqual([
      "メールアドレスまたはパスワードが正しくありません。",
    ]);
    // 失敗したら、ユーザーは保存されない
    expect(queryClient.getQueryData(queryKeys.user)).toBeUndefined();
  });
});

describe("useLogout", () => {
  it("ログアウトすると、ユーザーが null になり、他のデータは捨てられる", async () => {
    server.use(
      http.post(LOGOUT_URL, () => new HttpResponse(null, { status: 204 })),
    );

    const { result, queryClient } = renderWithQuery(() => useLogout());
    queryClient.setQueryData(queryKeys.user, user);
    queryClient.setQueryData(["reservations"], [{ id: 1 }]);

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(queryKeys.user)).toBeNull();
    expect(queryClient.getQueryData(["reservations"])).toBeUndefined();
  });
});
