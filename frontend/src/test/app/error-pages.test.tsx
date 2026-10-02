import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";

/*
 * エラーページ（not-found.tsx・error.tsx）のテスト（docs/08 の 7）。
 */

it("見つからないページ: 文言と、トップページへのリンクを出す", () => {
  render(<NotFound />);

  expect(
    screen.getByRole("heading", {
      name: "お探しのページは見つかりませんでした",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "トップページへ戻る" }),
  ).toHaveAttribute("href", "/");
});

it("エラーページ: エラーの中身は出さず、「再読み込み」で retry を呼ぶ", async () => {
  const retry = jest.fn();
  // 開発者ツールに出す console.error は、テストの表示を汚さないように止める
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});

  render(
    <ErrorPage error={new Error("SQLSTATE[08006] 秘密の中身")} retry={retry} />,
  );

  expect(
    screen.getByRole("heading", { name: "ページを表示できませんでした" }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/秘密の中身/)).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "トップページへ戻る" }),
  ).toHaveAttribute("href", "/");

  await userEvent.click(screen.getByRole("button", { name: "再読み込み" }));
  expect(retry).toHaveBeenCalledTimes(1);

  consoleError.mockRestore();
});
