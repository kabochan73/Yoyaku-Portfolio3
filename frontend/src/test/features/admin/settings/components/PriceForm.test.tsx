import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { PriceForm } from "@/features/admin/settings/components/PriceForm";
import facilityJson from "@/test/fixtures/facility.json";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * 料金設定のフォーム（PriceForm）のテスト（docs/08 の 6.4・docs/06 の B16）。
 */

const FACILITY_URL = "http://localhost/api/facility";
const PRICES_URL = "http://localhost/api/admin/prices";

function renderForm() {
  render(<PriceForm />, { wrapper: withQueryClient(createTestQueryClient()) });
}

async function type(label: string, value: string) {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  if (value) await userEvent.type(input, value);
}

it("B16: 料金が届く前は、保存ボタンを出さない。届いたら今の値が入る", async () => {
  // 返事をテストの中から返せるようにする（返すまでは「読み込み中」）
  let respond: (() => void) | undefined;
  server.use(
    http.get(
      FACILITY_URL,
      () =>
        new Promise<Response>((resolve) => {
          respond = () => resolve(HttpResponse.json(facilityJson));
        }),
    ),
  );
  renderForm();

  // 取得が始まった（まだ返事は無い）ところで、保存ボタンが無いことを確かめる
  await waitFor(() => expect(respond).toBeDefined());
  expect(
    screen.queryByRole("button", { name: "保存する" }),
  ).not.toBeInTheDocument();

  respond?.();

  expect(await screen.findByLabelText("平日（円/時間）")).toHaveValue(4000);
  expect(screen.getByLabelText("土日（円/時間）")).toHaveValue(5000);
  expect(screen.getByRole("button", { name: "保存する" })).toBeInTheDocument();
});

it("料金を取れなかったら、エラーと再読み込みを出す（保存ボタンは出さない）", async () => {
  server.use(
    http.get(FACILITY_URL, () =>
      HttpResponse.json(
        { message: "error", code: "server_error", errors: {} },
        { status: 500 },
      ),
    ),
  );
  renderForm();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "料金を取得できませんでした",
  );
  expect(
    screen.queryByRole("button", { name: "保存する" }),
  ).not.toBeInTheDocument();
});

it("空欄・小数は、送らずに入力欄の下にエラーを出す（空欄を 0円にしない）", async () => {
  let called = false;
  server.use(
    http.get(FACILITY_URL, () => HttpResponse.json(facilityJson)),
    http.put(PRICES_URL, () => {
      called = true;
      return HttpResponse.json(facilityJson);
    }),
  );
  renderForm();
  await screen.findByLabelText("平日（円/時間）");

  await type("平日（円/時間）", "");
  await type("土日（円/時間）", "1.5");
  await userEvent.click(screen.getByRole("button", { name: "保存する" }));

  expect(
    await screen.findByText("平日の料金を入力してください。"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("土日の料金は0以上の整数で入力してください。"),
  ).toBeInTheDocument();
  expect(called).toBe(false);
});

it("保存できたら「保存しました」を出し、入力を変えたら消す", async () => {
  let sent: unknown;
  server.use(
    http.get(FACILITY_URL, () => HttpResponse.json(facilityJson)),
    http.put(PRICES_URL, async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json({
        data: {
          ...facilityJson.data,
          prices: { weekday: 4500, weekend: 6000 },
        },
      });
    }),
  );
  renderForm();
  await screen.findByLabelText("平日（円/時間）");

  await type("平日（円/時間）", "4500");
  await type("土日（円/時間）", "6000");
  await userEvent.click(screen.getByRole("button", { name: "保存する" }));

  expect(
    await screen.findByText("保存しました。トップページにも反映されました"),
  ).toBeInTheDocument();
  expect(sent).toEqual({ weekday: 4500, weekend: 6000 });
  expect(screen.getByLabelText("平日（円/時間）")).toHaveValue(4500);

  await userEvent.type(screen.getByLabelText("平日（円/時間）"), "0");
  expect(
    screen.queryByText("保存しました。トップページにも反映されました"),
  ).not.toBeInTheDocument();
});

it("サーバーの 422 は、その入力欄の下に出す", async () => {
  server.use(
    http.get(FACILITY_URL, () => HttpResponse.json(facilityJson)),
    http.put(PRICES_URL, () =>
      HttpResponse.json(
        {
          message: "入力内容を確認してください。",
          code: "validation_failed",
          errors: { weekend: ["土日の料金は0以上で指定してください。"] },
        },
        { status: 422 },
      ),
    ),
  );
  renderForm();
  await screen.findByLabelText("平日（円/時間）");

  await userEvent.click(screen.getByRole("button", { name: "保存する" }));

  expect(
    await screen.findByText("土日の料金は0以上で指定してください。"),
  ).toBeInTheDocument();
});
