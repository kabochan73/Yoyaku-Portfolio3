import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { getCurrentUser } from "./server";
import type { User } from "./types";

/*
 * getCurrentUser()（サーバーでログイン中のユーザーを取る）のテスト。
 *
 * cookies() / headers() は Next.js がリクエストを処理している最中にしか使えないので、
 * 「ブラウザから届いたリクエスト」を差し替えて真似る。
 * バックエンドへの通信は MSW で横取りし、送られたヘッダーを確かめる。
 */

// ブラウザから届いたリクエストの Cookie とヘッダー（テストごとに変える）
let incomingCookie = "";
let incomingHeaders = new Headers();

jest.mock("next/headers", () => ({
  cookies: async () => ({ toString: () => incomingCookie }),
  headers: async () => incomingHeaders,
}));

// jest.config.ts の API_URL・FRONTEND_URL
const USER_URL = "http://api.test/api/user";
const FRONTEND_URL = "http://frontend.test";

const user: User = {
  id: 1,
  name: "山田太郎",
  email: "taro@example.com",
  role: "user",
};

beforeEach(() => {
  incomingCookie = "";
  incomingHeaders = new Headers();
});

it("ブラウザの Cookie と Referer を付けて呼び、ユーザーを返す", async () => {
  incomingCookie = "futsal_session=abc; XSRF-TOKEN=xyz";
  let sent: Headers | undefined;
  server.use(
    http.get(USER_URL, ({ request }) => {
      sent = request.headers;
      return HttpResponse.json({ data: user });
    }),
  );

  await expect(getCurrentUser()).resolves.toEqual(user);

  expect(sent?.get("cookie")).toBe("futsal_session=abc; XSRF-TOKEN=xyz");
  // Sanctum が Cookie のセッションを見るのに必要
  expect(sent?.get("referer")).toBe(FRONTEND_URL);
  expect(sent?.get("accept")).toBe("application/json");
});

it("届いた X-Forwarded-For（利用者の IP）を引き継ぐ", async () => {
  incomingHeaders = new Headers({ "x-forwarded-for": "203.0.113.9" });
  let sent: Headers | undefined;
  server.use(
    http.get(USER_URL, ({ request }) => {
      sent = request.headers;
      return HttpResponse.json({ data: user });
    }),
  );

  await getCurrentUser();

  expect(sent?.get("x-forwarded-for")).toBe("203.0.113.9");
});

it("X-Forwarded-For が届いていなければ、付けない", async () => {
  let sent: Headers | undefined;
  server.use(
    http.get(USER_URL, ({ request }) => {
      sent = request.headers;
      return HttpResponse.json({ data: user });
    }),
  );

  await getCurrentUser();

  expect(sent?.has("x-forwarded-for")).toBe(false);
});

it("未ログイン（401）なら null を返す", async () => {
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

  await expect(getCurrentUser()).resolves.toBeNull();
});

it("サーバーのエラー（500）なら、エラーにする", async () => {
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

  await expect(getCurrentUser()).rejects.toThrow("status: 500");
});
