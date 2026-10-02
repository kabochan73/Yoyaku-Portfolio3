import { api, getCsrfCookie } from "@/lib/api-client";
import { ApiError } from "@/lib/api-error";
import type { LoginInput, RegisterInput, User } from "./types";

/*
 * 認証の API を呼ぶ関数（docs/05 の「features/<機能>/api.ts」）。
 *
 * API の URL を書くのはここだけ。画面の部品や hook は、これらの関数を通して呼ぶ。
 * 失敗は ApiError になって投げられる（lib/api-client.ts）。
 */

/** API が返す { data: ... } の形 */
type DataResponse<T> = { data: T };

/**
 * ログイン中のユーザーを取る（GET /api/user）。未ログインなら null。
 *
 * 未ログイン（401）は、エラーではなく「ログインしていない」という正常な状態として扱う。
 * ヘッダーで「ログイン」ボタンを出すときなどに、エラーの表示を出さないため。
 * それ以外の失敗（通信の失敗・500 など）は、そのままエラーにする。
 */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const response = await api.get<DataResponse<User>>("/user");
    return response.data.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

/**
 * ログイン（POST /api/login）。成功したらログイン中のユーザーを返す。
 *
 * 先に CSRF Cookie を受け取ってから送る（Laravel の CSRF の確認を通すため。docs/03）。
 * 失敗（メールアドレスかパスワードが違う）は 422 の ApiError で、fieldErrors.credentials にメッセージが入る。
 */
export async function login(input: LoginInput): Promise<User> {
  await getCsrfCookie();
  const response = await api.post<DataResponse<User>>("/login", input);
  return response.data.data;
}

/**
 * 会員登録（POST /api/register）。成功したら、そのままログインした状態になり、ユーザーを返す。
 */
export async function register(input: RegisterInput): Promise<User> {
  await getCsrfCookie();
  const response = await api.post<DataResponse<User>>("/register", input);
  return response.data.data;
}

/** ログアウト（POST /api/logout） */
export async function logout(): Promise<void> {
  await api.post("/logout");
}
