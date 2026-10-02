/*
 * 認証まわりの型。バックエンドの UserResource（backend/app/Http/Resources/UserResource.php）と同じ形。
 */

/** ユーザーの役割。"user" = 会員、"admin" = 管理者 */
export type UserRole = "user" | "admin";

/** ログイン中のユーザー（GET /api/user などが返す data の中身） */
export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

/** ログインの入力 */
export type LoginInput = {
  email: string;
  password: string;
};

/** 会員登録の入力 */
export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
};

/** プロフィールの更新（PUT /api/user/profile）。パスワードを変えないときは空文字 */
export type UpdateProfileInput = {
  name: string;
  email: string;
  current_password: string;
  password: string;
  password_confirmation: string;
};
