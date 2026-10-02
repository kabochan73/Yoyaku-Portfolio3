import { ApiError, NETWORK_ERROR_MESSAGE } from "./api-error";
import { applyServerErrors } from "./form-errors";

/*
 * applyServerErrors（送信の失敗をフォームに振り分ける）のテスト。
 * setError は React Hook Form のものの代わりに、呼ばれ方を記録する偽物を使う。
 */

type Form = { name: string; email: string; password: string };
const FIELDS = ["name", "email", "password"] as const;

/** 422 の ApiError を作る */
function validationError(errors: Record<string, string[]>): ApiError {
  return new ApiError(
    422,
    "入力内容を確認してください。",
    "validation_failed",
    errors,
    {},
  );
}

it("フォームにある項目のエラーは、その入力欄に出し、上には何も出さない", () => {
  const setError = jest.fn();

  const result = applyServerErrors<Form>(
    validationError({
      email: ["このメールアドレスはすでに使われています。"],
      password: [
        "パスワードは8文字以上で入力してください。",
        "2件目は出さない",
      ],
    }),
    setError,
    FIELDS,
  );

  expect(result).toBeNull();
  // 各項目の最初の1件を出す。カーソルは最初の項目にだけ移す
  expect(setError).toHaveBeenCalledWith(
    "email",
    { type: "server", message: "このメールアドレスはすでに使われています。" },
    { shouldFocus: true },
  );
  expect(setError).toHaveBeenCalledWith(
    "password",
    { type: "server", message: "パスワードは8文字以上で入力してください。" },
    { shouldFocus: false },
  );
});

it("フォームに無い項目のエラー（ログインの credentials）は、フォームの上に出す", () => {
  const setError = jest.fn();

  const result = applyServerErrors<Form>(
    validationError({
      credentials: ["メールアドレスまたはパスワードが正しくありません。"],
    }),
    setError,
    FIELDS,
  );

  expect(result).toBe("メールアドレスまたはパスワードが正しくありません。");
  expect(setError).not.toHaveBeenCalled();
});

it("429 は、メッセージをフォームの上に出す", () => {
  const setError = jest.fn();

  const result = applyServerErrors<Form>(
    new ApiError(
      429,
      "試行回数が多すぎます。しばらくしてからお試しください。",
      "too_many_requests",
      {},
      {},
    ),
    setError,
    FIELDS,
  );

  expect(result).toBe("試行回数が多すぎます。しばらくしてからお試しください。");
  expect(setError).not.toHaveBeenCalled();
});

it("通信の失敗など ApiError 以外のエラーでも、フォームの上に文言を出す", () => {
  const setError = jest.fn();

  // axios のエラーではない、ただの Error（応答が無い扱い）
  const result = applyServerErrors<Form>(
    new Error("Network Error"),
    setError,
    FIELDS,
  );

  expect(result).toBe(NETWORK_ERROR_MESSAGE);
  expect(setError).not.toHaveBeenCalled();
});
