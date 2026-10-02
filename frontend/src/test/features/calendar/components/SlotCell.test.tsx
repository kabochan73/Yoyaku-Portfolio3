import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SlotCell,
  type SlotSelectionState,
} from "@/features/calendar/components/SlotCell";
import type { SlotStatus } from "@/features/calendar/types";

/*
 * カレンダーの1つの枠（SlotCell）のテスト（docs/08 の 3.2）。
 */

function renderSlot(
  status: SlotStatus | null,
  selectionState: SlotSelectionState = "none",
  onClick = jest.fn(),
) {
  // <td> は表の中にしか置けないので、表で包む
  render(
    <table>
      <tbody>
        <tr>
          <SlotCell
            date="2026-10-06"
            hour={12}
            status={status}
            selectionState={selectionState}
            onClick={onClick}
          />
        </tr>
      </tbody>
    </table>,
  );
  return { onClick };
}

it("空きの枠はボタンで、日付・時間・状態の名前が付き、押せる", async () => {
  const { onClick } = renderSlot("available");

  const button = screen.getByRole("button", {
    name: "10月6日（火）12:00 〜 13:00 空き",
  });
  expect(button).toBeEnabled();

  await userEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});

it.each([
  ["予約済み", "booked" as const, "10月6日（火）12:00 〜 13:00 予約済み"],
  ["過去の枠", "past" as const, "10月6日（火）12:00 〜 13:00 受付外"],
  ["受付外の日（枠なし）", null, "10月6日（火）12:00 〜 13:00 受付外"],
])("%sは押せない", (_label, status, name) => {
  renderSlot(status);

  expect(screen.getByRole("button", { name })).toBeDisabled();
});

it("PC とスマホで文言を変える（空き / 空、予約済 / ✕、－ / －）", () => {
  renderSlot("booked");

  expect(screen.getByText("予約済")).toBeInTheDocument();
  expect(screen.getByText("✕")).toBeInTheDocument();
});

it("開始に選んだ枠は「開始」で、押されている状態として伝える", () => {
  renderSlot("available", "start");

  expect(screen.getByText("開始")).toBeInTheDocument();
  expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
});

it("選び終わった範囲の枠は「選択中」", () => {
  renderSlot("available", "selected");

  expect(screen.getByText("選択中")).toBeInTheDocument();
  expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
});

describe("管理者用の表示（bookedLabel・bookedClickable）", () => {
  function renderAdminSlot(
    status: "booked" | "closed",
    bookedLabel?: string,
    onClick = jest.fn(),
  ) {
    render(
      <table>
        <tbody>
          <tr>
            <SlotCell
              date="2026-10-06"
              hour={12}
              status={status}
              selectionState="none"
              onClick={onClick}
              bookedLabel={bookedLabel}
              bookedClickable
            />
          </tr>
        </tbody>
      </table>,
    );
    return { onClick };
  }

  it("予約済みの枠に予約者名を出し（スマホは先頭2文字 +「…」）、押せる", async () => {
    const { onClick } = renderAdminSlot("booked", "☎ 電話 佐藤");

    const button = screen.getByRole("button", {
      name: "10月6日（火）12:00 〜 13:00 予約済み ☎ 電話 佐藤",
    });
    expect(screen.getByText("☎ 電話 佐藤")).toBeInTheDocument();
    expect(screen.getByText("☎電話…")).toBeInTheDocument();

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("受付外の日の予約が無い枠（closed）は「－」で押せない", () => {
    renderAdminSlot("closed");

    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getAllByText("－")).toHaveLength(2);
  });
});
