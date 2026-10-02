import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { queryKeys } from "@/lib/query-keys";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";
import { useCurrentUser } from "@/features/auth/hooks";
import type { User } from "@/features/auth/types";
import { UserProvider } from "@/features/auth/components/UserProvider";

/*
 * UserProvider（サーバーで取ったユーザーを先に入れておく部品）のテスト。
 */

const USER_URL = "http://localhost/api/user";

const user: User = {
  id: 1,
  name: "山田太郎",
  email: "taro@example.com",
  role: "user",
};

/** useCurrentUser() の結果を表示するだけの部品 */
function UserName() {
  const { data } = useCurrentUser();
  return <p>{data ? data.name : "なし"}</p>;
}

it("渡したユーザーが、GET /api/user を呼ばずに、最初の描画から読める", () => {
  let called = false;
  server.use(
    http.get(USER_URL, () => {
      called = true;
      return HttpResponse.json({ data: user });
    }),
  );
  const queryClient = createTestQueryClient();

  render(
    <UserProvider initialUser={user}>
      <UserName />
    </UserProvider>,
    { wrapper: withQueryClient(queryClient) },
  );

  // 待たずに（最初の描画で）表示されている
  expect(screen.getByText("山田太郎")).toBeInTheDocument();
  expect(queryClient.getQueryData(queryKeys.user)).toEqual(user);
  expect(called).toBe(false);
});

it("UserProvider の外（前）にある部品も、GET /api/user を呼ばずに読める（ヘッダーなど）", async () => {
  let called = false;
  server.use(
    http.get(USER_URL, () => {
      called = true;
      return HttpResponse.json({ data: user });
    }),
  );
  const queryClient = createTestQueryClient();

  render(
    <>
      {/* ヘッダーと同じく、UserProvider より前に描かれる部品 */}
      <UserName />
      <UserProvider initialUser={user}>
        <main />
      </UserProvider>
    </>,
    { wrapper: withQueryClient(queryClient) },
  );

  expect(await screen.findByText("山田太郎")).toBeInTheDocument();
  expect(called).toBe(false);
});
