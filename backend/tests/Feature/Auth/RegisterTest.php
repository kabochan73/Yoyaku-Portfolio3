<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

/*
 * 会員登録（POST /api/register）のテスト。
 * ログインのセッションが関わるので、フロントから来たリクエストにして呼ぶ（fromFrontend()。tests/Pest.php）。
 */

/**
 * 正しい入力。必要な項目だけ上書きして使う
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function registerInput(array $overrides = []): array
{
    return array_merge([
        'name' => '山田太郎',
        'email' => 'taro@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ], $overrides);
}

it('登録すると 201 でユーザーを返し、そのままログインした状態になる', function () {
    fromFrontend()->postJson('/api/register', registerInput())
        ->assertCreated()
        ->assertJson(['data' => ['name' => '山田太郎', 'email' => 'taro@example.com', 'role' => 'user']]);

    // 同じセッションのまま、ログインが必要な API が使える
    nextRequest();
    fromFrontend()->getJson('/api/user')->assertOk()->assertJsonPath('data.email', 'taro@example.com');
});

it('パスワードはハッシュ化して保存する（平文では保存しない）', function () {
    fromFrontend()->postJson('/api/register', registerInput())->assertCreated();

    $user = User::query()->where('email', 'taro@example.com')->firstOrFail();
    expect($user->password)->not->toBe('password123')
        ->and(Hash::check('password123', $user->password))->toBeTrue();
});

it('role: admin を混ぜて送っても、会員（user）になる', function () {
    fromFrontend()->postJson('/api/register', registerInput(['role' => 'admin']))
        ->assertCreated()
        ->assertJsonPath('data.role', 'user');

    expect(User::query()->where('email', 'taro@example.com')->firstOrFail()->role)->toBe(UserRole::User);
});

it('メールアドレスは小文字にそろえて保存する', function () {
    fromFrontend()->postJson('/api/register', registerInput(['email' => ' Taro@Example.COM ']))
        ->assertCreated()
        ->assertJsonPath('data.email', 'taro@example.com');
});

it('入力の誤りは、項目ごとの日本語のエラーになる', function (array $input, string $field, string $message) {
    fromFrontend()->postJson('/api/register', registerInput($input))
        ->assertUnprocessable()
        ->assertJsonPath('code', 'validation_failed')
        ->assertJsonPath("errors.{$field}.0", $message);
})->with([
    '名前が空' => [['name' => ''], 'name', '名前を入力してください。'],
    '名前が21文字' => [['name' => str_repeat('あ', 21)], 'name', '名前は20文字以内で入力してください。'],
    'メールアドレスの形式' => [['email' => 'taro'], 'email', 'メールアドレスの形式が正しくありません。'],
    'パスワードが7文字' => [['password' => 'pass123', 'password_confirmation' => 'pass123'], 'password', 'パスワードは8文字以上で入力してください。'],
    'パスワードの確認が不一致' => [['password_confirmation' => 'different123'], 'password', 'パスワードが確認用と一致しません。'],
]);

it('誤りが複数あれば、すべての項目のエラーを返す（R1 は最初の1件しか画面に出していなかった）', function () {
    fromFrontend()->postJson('/api/register', ['name' => '', 'email' => 'taro', 'password' => ''])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name', 'email', 'password']);
});

it('使われているメールアドレスは登録できない（大文字・小文字だけ違うものも）', function (string $email) {
    User::factory()->create(['email' => 'taro@example.com']);

    fromFrontend()->postJson('/api/register', registerInput(['email' => $email]))
        ->assertUnprocessable()
        ->assertJsonPath('errors.email.0', 'このメールアドレスはすでに使われています。');
})->with(['taro@example.com', 'TARO@example.com']);

it('同じ IP・メールアドレスから 1分に5回までで、6回目は 429', function () {
    // わざと入力を誤らせて、回数だけを数える（成功するとユーザーが増えて条件が変わるため）
    for ($i = 1; $i <= 5; $i++) {
        fromFrontend()->postJson('/api/register', registerInput(['password_confirmation' => 'x']))
            ->assertUnprocessable();
    }

    fromFrontend()->postJson('/api/register', registerInput(['password_confirmation' => 'x']))
        ->assertStatus(429)
        ->assertJsonPath('code', 'too_many_requests');
});
