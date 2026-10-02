import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeekNavigator } from "@/features/calendar/components/WeekNavigator";

/*
 * 週送り（WeekNavigator）のテスト（docs/08 の 3.5）。
 */

function renderNavigator(canGoPrev: boolean, canGoNext: boolean) {
  const onPrev = jest.fn();
  const onNext = jest.fn();
  render(
    <WeekNavigator
      weekLabel="10/5 〜 10/11"
      canGoPrev={canGoPrev}
      canGoNext={canGoNext}
      onPrev={onPrev}
      onNext={onNext}
    />,
  );
  return { onPrev, onNext };
}

it("表示中の週と、前後のボタンを出す", async () => {
  const { onPrev, onNext } = renderNavigator(true, true);

  expect(screen.getByText("10/5 〜 10/11")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "← 前の週" }));
  await userEvent.click(screen.getByRole("button", { name: "次の週 →" }));
  expect(onPrev).toHaveBeenCalledTimes(1);
  expect(onNext).toHaveBeenCalledTimes(1);
});

it("戻れない・進めないときは、ボタンを本当に押せなくする（R1 は見た目だけ薄かった）", async () => {
  const { onPrev, onNext } = renderNavigator(false, false);

  const prev = screen.getByRole("button", { name: "← 前の週" });
  const next = screen.getByRole("button", { name: "次の週 →" });
  expect(prev).toBeDisabled();
  expect(next).toBeDisabled();

  await userEvent.click(prev);
  await userEvent.click(next);
  expect(onPrev).not.toHaveBeenCalled();
  expect(onNext).not.toHaveBeenCalled();
});
