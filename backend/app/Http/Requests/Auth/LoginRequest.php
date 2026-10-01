<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * ログイン（POST /api/login）の入力チェック。
 *
 * ここで調べるのは「入力の形」だけ（空でないか・メールの形式か）。
 * メールアドレスとパスワードが合っているかは、コントローラー（SessionController）が調べる。
 */
final class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * チェックの前に、メールアドレスを小文字にそろえる（前後の空白も落とす）。
     * 会員登録（RegisterRequest）で小文字にそろえて保存しているので、照合するときも同じにする。
     * これで「Taro@Example.com」と入力してもログインできる。
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ];
    }
}
