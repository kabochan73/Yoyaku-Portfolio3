import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/Button";

it("押せる間は、クリックが届く", async () => {
  const onClick = jest.fn();
  render(<Button onClick={onClick}>予約する</Button>);

  await userEvent.click(screen.getByRole("button", { name: "予約する" }));

  expect(onClick).toHaveBeenCalledTimes(1);
});

it("送信中は押せず、文言が替わる（二重送信を防ぐ）", async () => {
  const onClick = jest.fn();
  render(
    <Button onClick={onClick} loading loadingText="予約中...">
      予約する
    </Button>,
  );

  const button = screen.getByRole("button", { name: "予約中..." });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("aria-busy", "true");

  await userEvent.click(button);
  expect(onClick).not.toHaveBeenCalled();
});

it("type の既定は button（フォームの中で押しても送信されない）", () => {
  render(<Button>戻る</Button>);

  expect(screen.getByRole("button", { name: "戻る" })).toHaveAttribute(
    "type",
    "button",
  );
});
