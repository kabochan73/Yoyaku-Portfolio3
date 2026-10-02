import axios from "axios";

/*
 * API のエラーを、フロントで扱う1つの形（ApiError）にそろえる（docs/05 の「API 呼び出し層」）。
 *
 * バックエンドは、すべてのエラーを次の形で返す（D5。backend の ApiExceptionRenderer）:
 *   { "message": "画面に出せる日本語", "code": "slot_taken", "errors": { "email": ["…"] } }
 *
 * R1 は各所で error.response?.data?.message のように axios のエラーの中身を直接たどっていた。
 * R2 は、画面の部品や hook は ApiError だけを見ればよい。
 */

/** 通信そのものが失敗したとき（サーバーが落ちている・オフラインなど）のメッセージ */
export const NETWORK_ERROR_MESSAGE =
  "通信に失敗しました。時間をおいて再度お試しください。";

/** 決まった形ではないエラーが返ってきたとき（中継のサーバーのエラー画面など）のメッセージ */
export const UNEXPECTED_ERROR_MESSAGE =
  "サーバーでエラーが発生しました。時間をおいて再度お試しください。";

/** 項目ごとのエラー（422）。例: { email: ["メールアドレスの形式が正しくありません。"] } */
export type FieldErrors = Record<string, string[]>;

/** バックエンドが返すエラーの JSON の形 */
type ErrorBody = {
  message: string;
  code?: string;
  errors?: FieldErrors;
};

export class ApiError extends Error {
  /**
   * @param status      HTTP のステータス（422 など）。通信そのものが失敗したときは 0
   * @param message     画面にそのまま出せる日本語のメッセージ
   * @param code        フロントが分岐に使う名前（"slot_taken" など）。決まった形でないエラーなら null
   * @param fieldErrors 項目ごとのエラー（422 のとき）。それ以外は空
   * @param body        レスポンスの中身そのもの。409 の追加情報（reservation_count など）を読むときに使う
   */
  constructor(
    readonly status: number,
    message: string,
    readonly code: string | null,
    readonly fieldErrors: FieldErrors,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** バックエンドが返す決まった形のエラーか（少なくとも message が文字列であること） */
function isErrorBody(data: unknown): data is ErrorBody {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as ErrorBody).message === "string"
  );
}

/**
 * どんな失敗も ApiError に変換する。
 *
 * - バックエンドの決まった形のエラー → その message・code・errors をそのまま使う
 * - 決まった形ではない応答（中継のサーバーのエラー画面など） → ステータスはそのまま、メッセージは汎用のもの
 * - 応答そのものが無い（通信の失敗） → status 0、「通信に失敗しました…」
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isAxiosError(error) && error.response) {
    const { status, data } = error.response;

    if (isErrorBody(data)) {
      return new ApiError(
        status,
        data.message,
        data.code ?? null,
        data.errors ?? {},
        data,
      );
    }

    return new ApiError(status, UNEXPECTED_ERROR_MESSAGE, null, {}, data);
  }

  return new ApiError(0, NETWORK_ERROR_MESSAGE, null, {}, null);
}
