import { z } from "zod";

/*
 * 認証のフォームの入力ルール（docs/05 の「フォーム」）。
 *
 * サーバー（backend の RegisterRequest / LoginRequest）と同じ決まりにして、
 * 送信する前にブラウザで分かる間違いを、その場で知らせる。
 * ブラウザのチェックは使いやすさのためで、守りはサーバーのチェック（メールの重複などはサーバーでしか分からない）。
 *
 * 文言は、サーバーの lang/ja/validation.php と同じ言い回しにそろえる。
 */

/** メールアドレス（空なら「入力してください」、形が違えば「形式が正しくありません」） */
const email = z
  .string()
  .trim()
  .min(1, "メールアドレスを入力してください。")
  .max(255, "メールアドレスは255文字以内で入力してください。")
  .pipe(z.email("メールアドレスの形式が正しくありません。"));

export const loginSchema = z.object({
  email,
  // ログインでは長さを確かめない（登録時の決まりが変わっても、前に作ったパスワードで入れるように）
  password: z.string().min(1, "パスワードを入力してください。"),
});

export const registerSchema = z
  .object({
    // users.name は varchar(20)（backend の RegisterRequest）
    name: z
      .string()
      .trim()
      .min(1, "名前を入力してください。")
      .max(20, "名前は20文字以内で入力してください。"),
    email,
    password: z.string().min(8, "パスワードは8文字以上で入力してください。"),
    password_confirmation: z.string(),
  })
  // 確認用と一致しないときは、確認用の欄の下に出す
  .refine((values) => values.password === values.password_confirmation, {
    message: "パスワードが確認用と一致しません。",
    path: ["password_confirmation"],
  });

/**
 * プロフィールの更新（backend の UpdateProfileRequest と同じ決まり。docs/08 の 5.4）。
 *
 * - 名前・メールアドレスは必須（会員登録と同じ決まり）
 * - 新しいパスワードは任意。入れたときだけ、8文字以上・確認用と一致・現在のパスワードが必須
 * 現在のパスワードが合っているかはサーバーでしか分からない（違えば current_password の欄のエラーで返る）
 */
export const profileSchema = z
  .object({
    name: registerSchema.shape.name,
    email,
    current_password: z.string(),
    password: z
      .string()
      // 空（変えない）か、8文字以上
      .refine(
        (value) => value === "" || value.length >= 8,
        "パスワードは8文字以上で入力してください。",
      ),
    password_confirmation: z.string(),
  })
  .superRefine((values, context) => {
    // 新しいパスワードを入れていなければ、ほかは調べない
    if (values.password === "") {
      return;
    }
    if (values.password !== values.password_confirmation) {
      context.addIssue({
        code: "custom",
        message: "パスワードが確認用と一致しません。",
        path: ["password_confirmation"],
      });
    }
    if (values.current_password === "") {
      context.addIssue({
        code: "custom",
        message:
          "パスワードを変更するときは、現在のパスワードも入力してください。",
        path: ["current_password"],
      });
    }
  });

/** ログインのフォームの値 */
export type LoginValues = z.infer<typeof loginSchema>;

/** 会員登録のフォームの値 */
export type RegisterValues = z.infer<typeof registerSchema>;

/** プロフィールのフォームの値 */
export type ProfileValues = z.infer<typeof profileSchema>;
