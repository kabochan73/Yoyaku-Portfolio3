import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { CancelDialog } from "@/features/reservations/components/CancelDialog";
import type { Reservation } from "@/features/reservations/types";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * 予約のキャンセルの確認ダイアログ（CancelDialog）のテスト（docs/06・docs/08 の 5.3）。
 */

// useRouter は Next.js のアプリの中でしか動かないので、移動の指示（replace）だけを差し替える
const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const CANCEL_URL = "http://localhost/api/reservations/1/cancel";

const reservation: Reservation = {
  id: 1,
  date: "2026-10-07",
  start_hour: 12,
  end_hour: 14,
  hours: 2,
  price: 8000,
  status: "confirmed",
  phase: "before_start",
  is_cancellable: true,
  booker_name: "山田太郎",
};

function renderDialog() {
  const onClose = jest.fn();
  const onCancelled = jest.fn();
  render(
    <CancelDialog
      reservation={reservation}
      onClose={onClose}
      onCancelled={onCancelled}
    />,
    { wrapper: withQueryClient(createTestQueryClient()) },
  );
  return {
    onClose,
    onCancelled,
    dialog: screen.getByRole("dialog", { name: "予約をキャンセルしますか？" }),
  };
}

it("予約の内容を出し、閉じるボタンは「戻る」（R1 の「キャンセル」は紛らわしかった）", async () => {
  const { dialog, onClose } = renderDialog();

  expect(within(dialog).getByText("2026年10月7日（水）")).toBeInTheDocument();
  expect(within(dialog).getByText("¥8,000")).toBeInTheDocument();

  await userEvent.click(within(dialog).getByRole("button", { name: "戻る" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("キャンセルできたら onCancelled を呼ぶ", async () => {
  server.use(
    http.post(CANCEL_URL, () =>
      HttpResponse.json({
        data: { ...reservation, status: "cancelled", is_cancellable: false },
      }),
    ),
  );
  const { dialog, onCancelled } = renderDialog();

  await userEvent.click(
    within(dialog).getByRole("button", { name: "キャンセルする" }),
  );

  await screen.findByRole("button", { name: "キャンセルする" });
  expect(onCancelled).toHaveBeenCalledTimes(1);
});

it("送信中は「キャンセル中...」で、戻るも押せない", async () => {
  server.use(http.post(CANCEL_URL, () => new Promise<Response>(() => {})));
  const { dialog } = renderDialog();

  await userEvent.click(
    within(dialog).getByRole("button", { name: "キャンセルする" }),
  );

  expect(
    await within(dialog).findByRole("button", { name: "キャンセル中..." }),
  ).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "戻る" })).toBeDisabled();
});

it("B17: 409 なら、ダイアログを開いたまま、中にエラーを出す", async () => {
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
  const { dialog, onClose, onCancelled } = renderDialog();

  await userEvent.click(
    within(dialog).getByRole("button", { name: "キャンセルする" }),
  );

  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "この予約はキャンセルできません（開始済み、またはキャンセル済み）。",
  );
  expect(
    within(dialog).getByRole("button", { name: "キャンセルする" }),
  ).toBeDisabled();
  expect(onClose).not.toHaveBeenCalled();
  expect(onCancelled).not.toHaveBeenCalled();
});

it("セッションが切れていたら（401）、ログイン画面へ移す", async () => {
  server.use(
    http.post(CANCEL_URL, () =>
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
  const { dialog } = renderDialog();

  await userEvent.click(
    within(dialog).getByRole("button", { name: "キャンセルする" }),
  );

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
});
