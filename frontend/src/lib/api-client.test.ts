import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { api } from "./api-client";
import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  UNEXPECTED_ERROR_MESSAGE,
} from "./api-error";

/*
 * api（ブラウザから API を呼ぶ axios）のテスト。
 * MSW で API の返事を決めて、成功・各エラー・419 の送り直しを確かめる。
 *
 * テストの中のページの場所は http://localhost/ なので、"/api/..." は http://localhost/api/... になる。
 */

const URL = "http://localhost/api/example";
const CSRF_URL = "http://localhost/sanctum/csrf-cookie";

/** api を呼んで、失敗したら ApiError を返す（成功したらテストを失敗させる） */
async function catchApiError(request: Promise<unknown>): Promise<ApiError> {
  try {
    await request;
  } catch (error) {
    if (error instanceof ApiError) {
      return error;
    }
    throw error;
  }
  throw new Error("失敗するはずが、成功してしまった");
}

it("成功したら、データがそのまま返る", async () => {
  server.use(http.get(URL, () => HttpResponse.json({ data: { id: 1 } })));

  const response = await api.get("/example");

  expect(response.data).toEqual({ data: { id: 1 } });
});

it("422: 項目ごとのエラーが fieldErrors に入る", async () => {
  server.use(
    http.post(URL, () =>
      HttpResponse.json(
        {
          message: "入力内容を確認してください。",
          code: "validation_failed",
          errors: { email: ["メールアドレスの形式が正しくありません。"] },
        },
        { status: 422 },
      ),
    ),
  );

  const error = await catchApiError(api.post("/example", {}));

  expect(error.status).toBe(422);
  expect(error.code).toBe("validation_failed");
  expect(error.message).toBe("入力内容を確認してください。");
  expect(error.fieldErrors).toEqual({
    email: ["メールアドレスの形式が正しくありません。"],
  });
});

it("409: code と、追加情報（reservation_count など）が読める", async () => {
  server.use(
    http.post(URL, () =>
      HttpResponse.json(
        {
          message: "この日には2件の予約があります。",
          code: "holiday_has_reservations",
          reservation_count: 2,
        },
        { status: 409 },
      ),
    ),
  );

  const error = await catchApiError(api.post("/example", {}));

  expect(error.status).toBe(409);
  expect(error.code).toBe("holiday_has_reservations");
  expect(error.body).toMatchObject({ reservation_count: 2 });
  expect(error.fieldErrors).toEqual({});
});

it.each([
  [401, "unauthenticated", "ログインしてください。"],
  [
    500,
    "server_error",
    "サーバーでエラーが発生しました。時間をおいて再度お試しください。",
  ],
])(
  "%i: status・code・message がそのまま入る",
  async (status, code, message) => {
    server.use(
      http.get(URL, () => HttpResponse.json({ message, code }, { status })),
    );

    const error = await catchApiError(api.get("/example"));

    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(error.message).toBe(message);
  },
);

it("決まった形ではないエラー（中継のサーバーのエラー画面など）は、汎用のメッセージになる", async () => {
  server.use(
    http.get(
      URL,
      () => new HttpResponse("<html>Bad Gateway</html>", { status: 502 }),
    ),
  );

  const error = await catchApiError(api.get("/example"));

  expect(error.status).toBe(502);
  expect(error.code).toBeNull();
  expect(error.message).toBe(UNEXPECTED_ERROR_MESSAGE);
});

it("通信そのものが失敗したら、status 0 で「通信に失敗しました…」", async () => {
  server.use(http.get(URL, () => HttpResponse.error()));

  const error = await catchApiError(api.get("/example"));

  expect(error.status).toBe(0);
  expect(error.message).toBe(NETWORK_ERROR_MESSAGE);
});

describe("419（CSRF トークン切れ）", () => {
  it("CSRF Cookie を取り直して、1回だけ送り直す", async () => {
    let calls = 0;
    let csrfCalls = 0;
    server.use(
      http.post(URL, () => {
        calls += 1;
        // 1回目は期限切れ、2回目（送り直し）は成功
        return calls === 1
          ? HttpResponse.json(
              { message: "期限切れ", code: "csrf_token_mismatch" },
              { status: 419 },
            )
          : HttpResponse.json({ data: { ok: true } });
      }),
      http.get(CSRF_URL, () => {
        csrfCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const response = await api.post("/example", {});

    expect(response.data).toEqual({ data: { ok: true } });
    expect(calls).toBe(2);
    expect(csrfCalls).toBe(1);
  });

  it("送り直しても 419 なら、繰り返さずにエラーにする", async () => {
    let calls = 0;
    server.use(
      http.post(URL, () => {
        calls += 1;
        return HttpResponse.json(
          {
            message: "ページの有効期限が切れました。再読み込みしてください。",
            code: "csrf_token_mismatch",
          },
          { status: 419 },
        );
      }),
      http.get(CSRF_URL, () => new HttpResponse(null, { status: 204 })),
    );

    const error = await catchApiError(api.post("/example", {}));

    expect(error.status).toBe(419);
    expect(error.code).toBe("csrf_token_mismatch");
    expect(calls).toBe(2); // 最初の1回 + 送り直しの1回だけ
  });
});
