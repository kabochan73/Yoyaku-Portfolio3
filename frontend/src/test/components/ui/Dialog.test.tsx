import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

/*
 * Dialog のテスト。jsdom の <dialog> は jest.setup.ts で補っている（open の印を付ける・外すだけ）。
 * ブラウザ本来の動き（後ろの画面を操作できない など）ではなく、この部品が自分で書いた振る舞いを確かめる。
 */

/** ボタンで開け閉めできる画面（実際の使い方と同じ形） */
function Harness({
  busy = false,
  onClose,
}: {
  busy?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        開く
      </button>
      <Dialog
        open={open}
        title="予約内容の確認"
        busy={busy}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      >
        <p>中身</p>
        <button type="button" onClick={() => setOpen(false)}>
          戻る
        </button>
      </Dialog>
    </>
  );
}

/** Esc を押したときにブラウザが出す cancel イベントを出す */
function pressEscape(dialog: HTMLElement) {
  act(() => {
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
  });
}

it("開くとタイトル付きのダイアログとして見つかり、閉じると消える", async () => {
  render(<Harness />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "開く" }));
  // 見出しが、ダイアログの名前として結びついている
  expect(
    screen.getByRole("dialog", { name: "予約内容の確認" }),
  ).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "戻る" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("Esc で onClose が呼ばれる", async () => {
  const onClose = jest.fn();
  render(<Harness onClose={onClose} />);
  await userEvent.click(screen.getByRole("button", { name: "開く" }));

  pressEscape(screen.getByRole("dialog"));

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("送信中（busy）は、Esc でも背景のクリックでも閉じない", async () => {
  const onClose = jest.fn();
  render(<Harness busy onClose={onClose} />);
  await userEvent.click(screen.getByRole("button", { name: "開く" }));
  const dialog = screen.getByRole("dialog");

  pressEscape(dialog);
  await userEvent.click(dialog); // 背景のクリック（対象が <dialog> 自身）

  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("背景のクリックで閉じ、中身のクリックでは閉じない", async () => {
  const onClose = jest.fn();
  render(<Harness onClose={onClose} />);
  await userEvent.click(screen.getByRole("button", { name: "開く" }));

  await userEvent.click(screen.getByText("中身"));
  expect(onClose).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("dialog"));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("閉じたら、開く前のボタンにフォーカスが戻る", async () => {
  render(<Harness />);
  const openButton = screen.getByRole("button", { name: "開く" });

  await userEvent.click(openButton); // ここでフォーカスは「開く」ボタン
  await userEvent.click(screen.getByRole("button", { name: "戻る" }));

  expect(openButton).toHaveFocus();
});

it("開いている間は、後ろの画面のスクロールを止め、閉じたら戻す", async () => {
  render(<Harness />);
  expect(document.body.style.overflow).toBe("");

  await userEvent.click(screen.getByRole("button", { name: "開く" }));
  expect(document.body.style.overflow).toBe("hidden");

  await userEvent.click(screen.getByRole("button", { name: "戻る" }));
  expect(document.body.style.overflow).toBe("");
});
