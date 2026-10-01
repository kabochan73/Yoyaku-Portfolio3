<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;

/*
 * プロフィール更新（PUT /api/user/profile）のテスト。
 */

beforeEach(function () {
    $this->user = User::factory()->create([
        'name' => '山田太郎',
        'email' => 'taro@example.com',
        'password' => 'old-password',
    ]);
});

/**
 * ログインした状態で PUT /api/user/profile を呼ぶ
 *
 * @param  array<string, mixed>  $input
 */
function updateProfile(array $input): TestResponse
{
    return test()->actingAs(test()->user)->putJson('/api/user/profile', array_merge([
        'name' => '山田太郎',
        'email' => 'taro@example.com',
    ], $input));
}

it('名前とメールアドレスを変えられる（メールアドレスは小文字にそろう）', function () {
    updateProfile(['name' => '山田花子', 'email' => 'Hanako@Example.com'])
        ->assertOk()
        ->assertJson(['data' => ['name' => '山田花子', 'email' => 'hanako@example.com']]);

    expect($this->user->fresh()?->name)->toBe('山田花子');
});

it('自分の今のメールアドレスのままでも保存できる', function () {
    updateProfile(['email' => 'taro@example.com'])->assertOk();
});

it('他人が使っているメールアドレスにはできない', function () {
    User::factory()->create(['email' => 'other@example.com']);

    updateProfile(['email' => 'other@example.com'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.email.0', 'このメールアドレスはすでに使われています。');
});

it('パスワードを送らなければ、パスワードは変わらない', function () {
    updateProfile(['name' => '山田花子'])->assertOk();

    expect(Hash::check('old-password', $this->user->fresh()?->password ?? ''))->toBeTrue();
});

it('新しいパスワードを入れたのに、現在のパスワードが空ならエラー', function () {
    updateProfile(['password' => 'new-password', 'password_confirmation' => 'new-password'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.current_password.0', 'パスワードを変更するときは、現在のパスワードも入力してください。');
});

it('現在のパスワードが違えば、「現在のパスワード」の欄のエラーになる', function () {
    updateProfile([
        'current_password' => 'wrong-password',
        'password' => 'new-password',
        'password_confirmation' => 'new-password',
    ])
        ->assertUnprocessable()
        ->assertJsonPath('errors.current_password.0', '現在のパスワードが正しくありません。');

    expect(Hash::check('old-password', $this->user->fresh()?->password ?? ''))->toBeTrue();
});

it('パスワードを変えると、新しいパスワードでログインでき、古いパスワードではできない', function () {
    updateProfile([
        'current_password' => 'old-password',
        'password' => 'new-password',
        'password_confirmation' => 'new-password',
    ])->assertOk();

    // 別のブラウザからログインする想定（ログイン状態を持ち越さない）
    app('auth')->forgetGuards();
    fromFrontend()->postJson('/api/login', ['email' => 'taro@example.com', 'password' => 'old-password'])
        ->assertUnprocessable();
    fromFrontend()->postJson('/api/login', ['email' => 'taro@example.com', 'password' => 'new-password'])
        ->assertOk();
});

it('新しいパスワードも8文字以上・確認用と一致が必要', function () {
    updateProfile([
        'current_password' => 'old-password',
        'password' => 'short',
        'password_confirmation' => 'different',
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['password']);
});

it('role: admin を混ぜて送っても、会員のまま', function () {
    updateProfile(['role' => 'admin'])->assertOk()->assertJsonPath('data.role', 'user');

    expect($this->user->fresh()?->role)->toBe(UserRole::User);
});

it('未ログインなら 401', function () {
    fromFrontend()->putJson('/api/user/profile', ['name' => 'x', 'email' => 'x@example.com'])
        ->assertUnauthorized();
});
