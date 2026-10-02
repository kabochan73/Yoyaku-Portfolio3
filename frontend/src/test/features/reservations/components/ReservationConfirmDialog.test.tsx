import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { User } from "@/features/auth/types";
import { FacilityProvider } from "@/features/facility/components/FacilityProvider";
import type { Facility } from "@/features/facility/types";
import { ReservationConfirmDialog } from "@/features/reservations/components/ReservationConfirmDialog";
import type { Reservation } from "@/features/reservations/types";
import { queryKeys } from "@/lib/query-keys";
import facilityJson from "@/test/fixtures/facility.json";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * 予約内容の確認ダイアログのテスト（docs/08 の 3.6）。
 * 2026-10-07（水）の 12:00〜14:00 を選んだ状態で開く。平日の単価は 4,000円。
 */

const RESERVATIONS_URL = "http://localhost/api/reservations";
const facility: Facility = facilityJson.data;
const member: User = {
  id: 1,
  name: "山田太郎",
  email: "taro@example.com",
  role: "user",
};
const slot = { date: "2026-10-07", startHour: 12, endHour: 14 };

const created: Reservation = {
  id: 10,
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

/** ログイン状態（user）を決めて、ダイアログを開いた状態で描く */
function renderDialog(user: User | null) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.user, user);
  const onClose = jest.fn();
  const onReserved = jest.fn();

  render(
    <FacilityProvider facility={facility}>
      <ReservationConfirmDialog
        slot={slot}
        onClose={onClose}
        onReserved={onReserved}
      />
    </FacilityProvider>,
    { wrapper: withQueryClient(queryClient) },
  );

  return {
    onClose,
    onReserved,
    dialog: screen.getByRole("dialog", { name: "予約内容の確認" }),
  };
}

/** POST /api/reservations にエラーを返させる */
function respondError(status: number, body: object) {
  server.use(
    http.post(RESERVATIONS_URL, () => HttpResponse.json(body, { status })),
  );
}

it("選んだ日付・時間・利用時間・見積もりの料金を出す", () => {
  const { dialog } = renderDialog(member);

  expect(within(dialog).getByText("2026年10月7日（水）")).toBeInTheDocument();
  expect(within(dialog).getByText("12:00 〜 14:00")).toBeInTheDocument();
  expect(within(dialog).getByText("2時間")).toBeInTheDocument();
  expect(within(dialog).getByText("¥8,000（見積もり）")).toBeInTheDocument();
});

it("未ログインなら、ログインが必要なことと「ログインして予約」（/login へ）を出す", () => {
  const { dialog } = renderDialog(null);

  expect(
    within(dialog).getByText("予約にはログインが必要です。"),
  ).toBeInTheDocument();
  expect(
    within(dialog).getByRole("link", { name: "ログインして予約" }),
  ).toHaveAttribute("href", "/login");
  expect(
    within(dialog).queryByRole("button", { name: "予約する" }),
  ).not.toBeInTheDocument();
});

it("予約できたら、サーバーが返した予約を渡す", async () => {
  let sent: unknown;
  server.use(
    http.post(RESERVATIONS_URL, async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json({ data: created }, { status: 201 });
    }),
  );
  const { dialog, onReserved } = renderDialog(member);

  await userEvent.click(
    within(dialog).getByRole("button", { name: "予約する" }),
  );

  await screen.findByRole("button", { name: "予約する" });
  expect(sent).toEqual({ date: "2026-10-07", start_hour: 12, end_hour: 14 });
  expect(onReserved).toHaveBeenCalledWith(created);
});

it("送信中は「予約中...」で、押せない", async () => {
  // 返事を返さないままにして、送信中の状態を確かめる
  server.use(
    http.post(RESERVATIONS_URL, () => new Promise<Response>(() => {})),
  );
  const { dialog } = renderDialog(member);

  await userEvent.click(
    within(dialog).getByRole("button", { name: "予約する" }),
  );

  expect(
    await within(dialog).findByRole("button", { name: "予約中..." }),
  ).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "戻る" })).toBeDisabled();
});

it("422 なら、ダイアログを閉じずに、中にエラーを出す", async () => {
  respondError(422, {
    message: "入力内容を確認してください。",
    code: "validation_failed",
    errors: { start_hour: ["開始時刻を過ぎています。"] },
  });
  const { dialog, onClose } = renderDialog(member);

  await userEvent.click(
    within(dialog).getByRole("button", { name: "予約する" }),
  );

  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "開始時刻を過ぎています。",
  );
  expect(onClose).not.toHaveBeenCalled();
});

it("409 slot_taken なら、エラーを出し、「予約する」を押せなくする", async () => {
  respondError(409, {
    message: "その時間帯は先に予約されました。別の時間をお選びください。",
    code: "slot_taken",
  });
  const { dialog } = renderDialog(member);

  await userEvent.click(
    within(dialog).getByRole("button", { name: "予約する" }),
  );

  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "その時間帯は先に予約されました。",
  );
  expect(
    within(dialog).getByRole("button", { name: "予約する" }),
  ).toBeDisabled();
});

it("409 already_booked_that_day なら、エラーと「マイページで確認」を出す", async () => {
  respondError(409, {
    message: "この日はすでにご予約があります（1日1件まで）。",
    code: "already_booked_that_day",
  });
  const { dialog } = renderDialog(member);

  await userEvent.click(
    within(dialog).getByRole("button", { name: "予約する" }),
  );

  const alert = await within(dialog).findByRole("alert");
  expect(alert).toHaveTextContent(
    "この日はすでにご予約があります（1日1件まで）。",
  );
  expect(
    within(alert).getByRole("link", { name: "マイページで確認" }),
  ).toHaveAttribute("href", "/mypage");
});

it("「戻る」で閉じる", async () => {
  const { dialog, onClose } = renderDialog(member);

  await userEvent.click(within(dialog).getByRole("button", { name: "戻る" }));

  expect(onClose).toHaveBeenCalledTimes(1);
});
