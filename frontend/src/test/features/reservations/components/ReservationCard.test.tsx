import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReservationCard } from "@/features/reservations/components/ReservationCard";
import type { Reservation } from "@/features/reservations/types";

/*
 * マイページの予約のカード（ReservationCard）のテスト（docs/06・docs/08 の 5.2）。
 * phase・is_cancellable に応じて、「キャンセル」ボタン /「ご利用中」/「ご利用済み」を出し分ける。
 */

const base: Reservation = {
  id: 1,
  date: "2026-10-06",
  start_hour: 12,
  end_hour: 14,
  hours: 2,
  price: 8000,
  status: "confirmed",
  phase: "before_start",
  is_cancellable: true,
  booker_name: "山田太郎",
};

function renderCard(reservation: Reservation) {
  const onCancel = jest.fn();
  render(
    <ul>
      <ReservationCard reservation={reservation} onCancel={onCancel} />
    </ul>,
  );
  return { onCancel };
}

it("日付・時間・利用時間・料金を出す", () => {
  renderCard(base);

  expect(screen.getByText("2026年10月6日（火）")).toBeInTheDocument();
  expect(screen.getByText("12:00 〜 14:00（2時間）")).toBeInTheDocument();
  expect(screen.getByText("¥8,000")).toBeInTheDocument();
});

it("開始前なら「キャンセル」ボタンを出し、押すとその予約を渡す", async () => {
  const { onCancel } = renderCard(base);

  await userEvent.click(
    screen.getByRole("button", {
      name: "2026年10月6日（火） 12:00 〜 14:00 の予約をキャンセル",
    }),
  );

  expect(onCancel).toHaveBeenCalledWith(base);
});

it("利用中なら、ボタンの代わりに「ご利用中」", () => {
  renderCard({ ...base, phase: "in_use", is_cancellable: false });

  expect(screen.getByText("ご利用中")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("終わった予約なら、ボタンの代わりに「ご利用済み」（R1 はキャンセルボタンが出ていた）", () => {
  renderCard({ ...base, phase: "finished", is_cancellable: false });

  expect(screen.getByText("ご利用済み")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
