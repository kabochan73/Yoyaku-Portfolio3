import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { AdminReservationDialog } from "@/features/admin/calendar/components/AdminReservationDialog";
import type { AdminReservation } from "@/features/admin/calendar/types";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * 管理画面の予約の詳細ダイアログのテスト（docs/08 の 6.2・docs/06 の B17）。
 */

// useRouter は Next.js のアプリの中でしか動かないので差し替える（401 のときの移動に使う）
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

const CANCEL_URL = "http://localhost/api/admin/reservations/41/cancel";

const memberReservation: AdminReservation = {
  id: 41,
  date: "2026-10-07",
  start_hour: 18,
  end_hour: 20,
  hours: 2,
  price: 8000,
  status: "confirmed",
  phase: "before_start",
  is_cancellable: true,
  booker_name: "山田太郎",
  user_id: 5,
  is_phone: false,
};

function renderDialog(reservation: AdminReservation) {
  const onClose = jest.fn();
  const onCancelled = jest.fn();
  render(
    <AdminReservationDialog
      reservation={reservation}
      onClose={onClose}
      onCancelled={onCancelled}
    />,
    { wrapper: withQueryClient(createTestQueryClient()) },
  );
  return {
    onClose,
    onCancelled,
    dialog: screen.getByRole("dialog", { name: "予約詳細" }),
  };
}

it("予約者・種別・日付・時間・料金を出し、会員の予約ならメールが送られる旨を出す", () => {
  const { dialog } = renderDialog(memberReservation);

  expect(within(dialog).getByText("山田太郎")).toBeInTheDocument();
  expect(within(dialog).getByText("会員")).toBeInTheDocument();
  expect(within(dialog).getByText("2026年10月7日（水）")).toBeInTheDocument();
  expect(within(dialog).getByText("¥8,000")).toBeInTheDocument();
  expect(
    within(dialog).getByText("会員にキャンセルのメールが送られます"),
  ).toBeInTheDocument();
});

it("電話予約なら種別は「電話予約」で、メールの注意書きは出さない", () => {
  const { dialog } = renderDialog({
    ...memberReservation,
    user_id: null,
    is_phone: true,
  });

  expect(within(dialog).getByText("電話予約")).toBeInTheDocument();
  expect(
    within(dialog).queryByText("会員にキャンセルのメールが送られます"),
  ).not.toBeInTheDocument();
});

it("開始済みの予約には、キャンセルボタンを出さない", () => {
  const { dialog } = renderDialog({
    ...memberReservation,
    phase: "in_use",
    is_cancellable: false,
  });

  expect(
    within(dialog).queryByRole("button", { name: "この予約をキャンセル" }),
  ).not.toBeInTheDocument();
  expect(
    within(dialog).getByRole("button", { name: "閉じる" }),
  ).toBeInTheDocument();
});

it("キャンセルできたら onCancelled を呼ぶ", async () => {
  server.use(
    http.post(CANCEL_URL, () =>
      HttpResponse.json({
        data: { ...memberReservation, status: "cancelled" },
      }),
    ),
  );
  const { dialog, onCancelled } = renderDialog(memberReservation);

  await userEvent.click(
    within(dialog).getByRole("button", { name: "この予約をキャンセル" }),
  );

  await screen.findByRole("button", { name: "この予約をキャンセル" });
  expect(onCancelled).toHaveBeenCalledTimes(1);
});

it("B17: 失敗したら、閉じずにダイアログの中にエラーを出す", async () => {
  server.use(
    http.post(CANCEL_URL, () =>
      HttpResponse.json(
        {
          message:
            "この予約はキャンセルできません（開始済み、またはキャンセル済み）。",
          code: "reservation_not_cancellable",
        },
        { status: 409 },
      ),
    ),
  );
  const { dialog, onClose } = renderDialog(memberReservation);

  await userEvent.click(
    within(dialog).getByRole("button", { name: "この予約をキャンセル" }),
  );

  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "この予約はキャンセルできません",
  );
  expect(onClose).not.toHaveBeenCalled();
});
