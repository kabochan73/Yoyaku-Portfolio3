import { render, screen } from "@testing-library/react";
import { FormField } from "@/components/ui/FormField";

it("ラベルで入力欄を探せる（ラベルと入力欄が結びついている）", () => {
  render(
    <FormField id="login-email" label="メールアドレス">
      {(control) => <input type="email" {...control} />}
    </FormField>,
  );

  const input = screen.getByLabelText("メールアドレス");
  expect(input).toHaveAttribute("id", "login-email");
  expect(input).toHaveAttribute("aria-invalid", "false");
});

it("エラーがあれば aria-invalid が付き、エラー文が入力欄の説明として結びつく", () => {
  render(
    <FormField
      id="login-email"
      label="メールアドレス"
      error="メールアドレスの形式が正しくありません。"
    >
      {(control) => <input type="email" {...control} />}
    </FormField>,
  );

  const input = screen.getByLabelText("メールアドレス");
  expect(input).toHaveAttribute("aria-invalid", "true");
  // 画面読み上げは、入力欄の説明としてエラー文を読む
  expect(input).toHaveAccessibleDescription(
    "メールアドレスの形式が正しくありません。",
  );
});

it("補足とエラーの両方があれば、両方を説明として結びつける", () => {
  render(
    <FormField
      id="register-password"
      label="パスワード"
      hint="8文字以上"
      error="短すぎます。"
    >
      {(control) => <input type="password" {...control} />}
    </FormField>,
  );

  expect(screen.getByLabelText("パスワード")).toHaveAccessibleDescription(
    "8文字以上 短すぎます。",
  );
});
