import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { PhoneReservationDialog } from "@/features/admin/calendar/components/PhoneReservationDialog";
import facilityJson from "@/test/fixtures/facility.json";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * 電話予約の登録ダイアログのテスト（docs/08 の 6.3）。
 * 管理画面には FacilityProvider が無いので、施設情報は GET /api/facility から取る。
 */

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

const ADMIN_RESERVATIONS_URL = "http://localhost/api/admin/reservations";
const slot = { date: "2026-10-07", startHour: 12, endHour: 14 };

async function renderDialog() {
  server.use(
    http.get("http://localhost/api/facility", () =>
      HttpResponse.json(facilityJson),
    ),
  );
  const onClose = jest.fn();
  const onReserved = jest.fn();
  render(
    <PhoneReservationDialog
      slot={slot}
      onClose={onClose}
      onReserved={onReserved}
    />,
    {
      wrapper: withQueryClient(createTestQueryClient()),
    },
  );
  const dialog = screen.getByRole("dialog", { name: "電話予約の登録" });
  // 施設情報が届くと、中身が出る
  await within(dialog).findByLabelText("予約者名");
  return { onClose, onReserved, dialog };
}

it("選んだ時間帯と見積もりを出し、予約者名の欄にカーソルがある", async () => {
  const { dialog } = await renderDialog();

  expect(within(dialog).getByText("2026年10月7日（水）")).toBeInTheDocument();
  expect(within(dialog).getByText("¥8,000（見積もり）")).toBeInTheDocument();
  expect(within(dialog).getByLabelText("予約者名")).toHaveFocus();
});

it("予約者名が空なら、送らずに入力欄の下にエラーを出す", async () => {
  let called = false;
  server.use(
    http.post(ADMIN_RESERVATIONS_URL, () => {
      called = true;
      return HttpResponse.json({ data: {} }, { status: 201 });
    }),
  );
  const { dialog } = await renderDialog();

  await userEvent.click(
    within(dialog).getByRole("button", { name: "登録する" }),
  );

  expect(
    await within(dialog).findByText("予約者名を入力してください。"),
  ).toBeInTheDocument();
  expect(called).toBe(false);
});

it("予約者名を入れて Enter で登録し、onReserved を呼ぶ", async () => {
  let sent: unknown;
  server.use(
    http.post(ADMIN_RESERVATIONS_URL, async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json({ data: { id: 1 } }, { status: 201 });
    }),
  );
  const { dialog, onReserved } = await renderDialog();

  await userEvent.type(
    within(dialog).getByLabelText("予約者名"),
    "電話 佐藤{Enter}",
  );

  await screen.findByRole("button", { name: "登録する" });
  expect(sent).toEqual({
    date: "2026-10-07",
    start_hour: 12,
    end_hour: 14,
    booker_name: "電話 佐藤",
  });
  expect(onReserved).toHaveBeenCalledTimes(1);
});

it("409 slot_taken なら、エラーを出し、「登録する」を押せなくする", async () => {
  server.use(
    http.post(ADMIN_RESERVATIONS_URL, () =>
      HttpResponse.json(
        {
          message: "その時間帯は先に予約されました。別の時間をお選びください。",
          code: "slot_taken",
        },
        { status: 409 },
      ),
    ),
  );
  const { dialog } = await renderDialog();

  await userEvent.type(within(dialog).getByLabelText("予約者名"), "電話 佐藤");
  await userEvent.click(
    within(dialog).getByRole("button", { name: "登録する" }),
  );

  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "その時間帯は先に予約されました。",
  );
  expect(
    within(dialog).getByRole("button", { name: "登録する" }),
  ).toBeDisabled();
});
