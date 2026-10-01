<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Contracts\Validation\Rule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Rules\Unique;

/**
 * プロフィール更新（PUT /api/user/profile）の入力チェック。ルールは docs/01 の「会員登録・プロフィール」。
 *
 * 名前とメールアドレスは毎回送る。パスワードの3項目（current_password・password・password_confirmation）は、
 * パスワードを変えるときだけ送る。
 */
final class UpdateProfileRequest extends FormRequest
{
    /**
     * ログインしていれば、自分のプロフィールを更新できる（ルートの auth:sanctum で確かめ済み）。
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * チェックの前に、メールアドレスを小文字にそろえる（会員登録・ログインと同じ）。
     */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
    }

    /**
     * @return array<string, list<Rule|Unique|string>>
     */
    public function rules(): array
    {
        /** @var User $user */
        $user = $this->user();

        return [
            'name' => ['required', 'string', 'max:20'],

            // 自分以外の人が使っていないこと。ignore で自分の行を除くので、今のアドレスのままでも保存できる
            'email' => ['required', 'string', 'email', 'max:255', (new Unique('users'))->ignore($user->id)],

            // 新しいパスワード（任意）。入れたら8文字以上で、password_confirmation と一致すること
            'password' => ['nullable', 'string', 'confirmed', Password::min(8)],

            // 現在のパスワード。新しいパスワードを入れたときは必須で、今のパスワードと一致すること。
            // current_password は Laravel 標準のルール。違っていたら「現在のパスワード」の欄のエラーになる
            // （R1 はコントローラーで調べて、項目に付かない全体のメッセージとして返していた。docs/04）
            'current_password' => ['nullable', 'required_with:password', 'string', 'current_password:web'],
        ];
    }
}
