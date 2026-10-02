import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { Accordion } from "@/components/ui/Accordion";

/*
 * 開け閉めできる区切り（Accordion）のテスト。
 */

it("最初は閉じていて、見出しを押すと開き、もう一度押すと閉じる", async () => {
  render(
    <Accordion title="プロフィール設定">
      <p>中身</p>
    </Accordion>,
  );
  const button = screen.getByRole("button", { name: "プロフィール設定" });

  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("中身")).not.toBeInTheDocument();

  await userEvent.click(button);
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("中身")).toBeInTheDocument();

  await userEvent.click(button);
  expect(screen.queryByText("中身")).not.toBeInTheDocument();
});

it("中身は開くまで描かない（中の部品のデータ取得を遅らせる）", async () => {
  const mounted = jest.fn();
  function Child() {
    useEffect(() => mounted(), []);
    return <p>中身</p>;
  }
  render(
    <Accordion title="ユーザー検索">
      <Child />
    </Accordion>,
  );

  expect(mounted).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: "ユーザー検索" }));
  expect(mounted).toHaveBeenCalledTimes(1);
});

it("defaultOpen なら最初から開いている", () => {
  render(
    <Accordion title="料金設定" defaultOpen>
      <p>中身</p>
    </Accordion>,
  );

  expect(screen.getByText("中身")).toBeInTheDocument();
});
