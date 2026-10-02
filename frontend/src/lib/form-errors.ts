import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toApiError } from "./api-error";

/*
 * 送信に失敗したときのエラーを、フォームに出す（docs/05 の「フォーム」、docs/08 の 1.1）。
 *
 * サーバーのエラーを、出す場所ごとに振り分ける:
 * - 422 の項目ごとのエラーのうち、フォームにある項目（email など） → その入力欄の下（setError）
 * - それ以外（フォームに無い項目のエラー・429・500・通信の失敗など） → フォームの上（戻り値の文言）
 *   例: ログインの失敗は errors.credentials で返る。credentials という入力欄は無いので、フォームの上に出す
 *
 * R1 は登録画面で最初の1件だけ、プロフィールでは message だけを出していた。R2 は全部の項目に出す。
 *
 * 使い方:
 *   const [formError, setFormError] = useState<string | null>(null);
 *   mutation.mutate(values, {
 *     onError: (error) => setFormError(applyServerErrors(error, form.setError, ["email", "password"])),
 *   });
 */

/**
 * @param error    送信で起きたエラー（ApiError 以外が来ても扱える）
 * @param setError React Hook Form の setError
 * @param fields   このフォームにある項目の名前。ここに無い項目のエラーはフォームの上に出す
 * @returns フォームの上に出す文言。すべて入力欄の下に出せたときは null
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  const apiError = toApiError(error);

  // 項目ごとのエラーが無い失敗（429・500・通信の失敗など）は、メッセージをそのままフォームの上に出す
  const entries = Object.entries(apiError.fieldErrors);
  if (apiError.status !== 422 || entries.length === 0) {
    return apiError.message;
  }

  const unplaced: string[] = [];
  let focused = false;

  for (const [name, messages] of entries) {
    const message = messages[0];
    if (message === undefined) {
      continue;
    }

    if (isField(name, fields)) {
      // 最初のエラーの入力欄にカーソルを移す（直す場所がすぐ分かるように）
      setError(name, { type: "server", message }, { shouldFocus: !focused });
      focused = true;
    } else {
      unplaced.push(message);
    }
  }

  return unplaced.length > 0 ? unplaced.join("\n") : null;
}

/** name がこのフォームの項目か（型を Path<T> に絞る） */
function isField<T extends FieldValues>(
  name: string,
  fields: readonly Path<T>[],
): name is Path<T> {
  return (fields as readonly string[]).includes(name);
}
