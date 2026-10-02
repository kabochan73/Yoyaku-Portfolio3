import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorState } from "@/components/ui/ErrorState";

it("エラー文を出し、「再読み込み」を押すと処理が呼ばれる", async () => {
  const onRetry = jest.fn();
  render(
    <ErrorState message="空き状況を取得できませんでした" onRetry={onRetry} />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent(
    "空き状況を取得できませんでした",
  );

  await userEvent.click(screen.getByRole("button", { name: "再読み込み" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

it("onRetry を渡さなければ、ボタンを出さない", () => {
  render(<ErrorState message="取得できませんでした" />);

  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
