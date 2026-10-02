import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { RegularHolidayForm } from "@/features/admin/settings/components/RegularHolidayForm";
import facilityJson from "@/test/fixtures/facility.json";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * 定休日設定のフォーム（RegularHolidayForm）のテスト（docs/08 の 6.5・docs/06 の B16）。
 * 施設情報の初期値では、月曜（1）が定休日。
 */

const FACILITY_URL = "http://localhost/api/facility";
const REGULAR_HOLIDAYS_URL = "http://localhost/api/admin/regular-holidays";

/** 保存で送られた曜日を記録する */
function respondSave() {
  const sent: { days?: number[] } = {};
  server.use(
    http.get(FACILITY_URL, () => HttpResponse.json(facilityJson)),
    http.put(REGULAR_HOLIDAYS_URL, async ({ request }) => {
      Object.assign(sent, await request.json());
      return HttpResponse.json({
        data: { ...facilityJson.data, regular_holidays: sent.days ?? [] },
      });
    }),
  );
  return sent;
}

function renderForm() {
  render(<RegularHolidayForm />, {
    wrapper: withQueryClient(createTestQueryClient()),
  });
}

it("B16: 値が届く前は保存ボタンを出さず、届いたら今の定休日が選ばれている", async () => {
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

  await waitFor(() => expect(respond).toBeDefined());
  expect(
    screen.queryByRole("button", { name: "保存する" }),
  ).not.toBeInTheDocument();

  respond?.();

  expect(await screen.findByRole("button", { name: "月曜日" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "火曜日" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(
    screen.getByText("すでに入っている予約はキャンセルされません"),
  ).toBeInTheDocument();
});

it("曜日を押すたびに選ぶ・外すが切り替わり、保存すると選んだ曜日を送る", async () => {
  const sent = respondSave();
  renderForm();

  await userEvent.click(await screen.findByRole("button", { name: "水曜日" }));
  await userEvent.click(screen.getByRole("button", { name: "日曜日" }));
  await userEvent.click(screen.getByRole("button", { name: "月曜日" }));
  expect(screen.getByRole("button", { name: "月曜日" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await userEvent.click(screen.getByRole("button", { name: "保存する" }));

  expect(
    await screen.findByText("保存しました。トップページにも反映されました"),
  ).toBeInTheDocument();
  // 小さい順にそろえて送る
  expect(sent.days).toEqual([0, 3]);
});

it("全部外して保存すると、定休日なし（空の配列）を送る", async () => {
  const sent = respondSave();
  renderForm();

  await userEvent.click(await screen.findByRole("button", { name: "月曜日" }));
  await userEvent.click(screen.getByRole("button", { name: "保存する" }));

  await screen.findByText("保存しました。トップページにも反映されました");
  expect(sent.days).toEqual([]);
});
