<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use Illuminate\Contracts\Validation\Rule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

/**
 * 会員登録（POST /api/register）の入力チェック。ルールは docs/01 の「会員登録・プロフィール」。
 *
 * 違反があれば、コントローラーに届く前に 422 validation_failed（項目ごとのエラー）になる。
 * メッセージは lang/ja/validation.php。
 */
final class RegisterRequest extends FormRequest
{
    /**
     * 誰でも（ログインしていない人も）登録できる。
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * チェックの前に、メールアドレスを小文字にそろえる（前後の空白も落とす）。
     *
     * PostgreSQL は文字列の大文字・小文字を区別するので、そろえないと
     * 「Taro@example.com」と「taro@example.com」が別の人として登録できてしまう。
     * ログイン（LoginRequest）でも同じようにそろえる。
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
    }

    /**
     * @return array<string, list<Rule|string>> Password::min() は Rule（Laravel のルールの古い形）を実装している
     */
    public function rules(): array
    {
        return [
            // users.name は varchar(20)
            'name' => ['required', 'string', 'max:20'],
            // unique:users … users テーブルの email に同じ値が無いこと
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            // confirmed … password_confirmation と一致すること
            'password' => ['required', 'string', 'confirmed', Password::min(8)],
        ];
    }
}
