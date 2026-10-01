<?php

declare(strict_types=1);

use App\Models\User;

/*
 * ログイン（POST /api/login）のテスト。
 */

beforeEach(function () {
    $this->user = User::factory()->create([
        'email' => 'taro@example.com',
        'password' => 'password123',
    ]);
});

it('正しいメールアドレスとパスワードでログインでき、そのまま /api/user が使える', function () {
    fromFrontend()->postJson('/api/login', ['email' => 'taro@example.com', 'password' => 'password123'])
        ->assertOk()
        ->assertJsonPath('data.id', $this->user->id);

    nextRequest();
    fromFrontend()->getJson('/api/user')->assertOk()->assertJsonPath('data.email', 'taro@example.com');
});

it('大文字が混じったメールアドレスでもログインできる', function () {
    fromFrontend()->postJson('/api/login', ['email' => ' Taro@Example.COM ', 'password' => 'password123'])
        ->assertOk();
});

it('パスワード違いと、登録されていないメールアドレスは、同じエラーになる（どちらが違うかは教えない）', function (string $email, string $password) {
    $response = fromFrontend()->postJson('/api/login', ['email' => $email, 'password' => $password]);

    $response->assertUnprocessable()
        ->assertExactJson([
            'message' => '入力内容を確認してください。',
            'code' => 'validation_failed',
            'errors' => ['credentials' => ['メールアドレスまたはパスワードが正しくありません。']],
        ]);

    // ログインしていない
    nextRequest();
    fromFrontend()->getJson('/api/user')->assertUnauthorized();
})->with([
    'パスワード違い' => ['taro@example.com', 'wrong-password'],
    '登録されていないメールアドレス' => ['nobody@example.com', 'password123'],
]);

it('空の入力は、項目ごとのエラーになる', function () {
    fromFrontend()->postJson('/api/login', ['email' => '', 'password' => ''])
        ->assertUnprocessable()
        ->assertJsonPath('errors.email.0', 'メールアドレスを入力してください。')
        ->assertJsonPath('errors.password.0', 'パスワードを入力してください。');
});

it('同じ IP・メールアドレスから 1分に5回までで、6回目は正しいパスワードでも 429', function () {
    for ($i = 1; $i <= 5; $i++) {
        fromFrontend()->postJson('/api/login', ['email' => 'taro@example.com', 'password' => 'wrong'])
            ->assertUnprocessable();
    }

    // パスワードを総当たりで試し続けられないよう、正しいパスワードでも止める
    fromFrontend()->postJson('/api/login', ['email' => 'taro@example.com', 'password' => 'password123'])
        ->assertStatus(429)
        ->assertJsonPath('code', 'too_many_requests');
});

it('別のメールアドレスなら、同じ IP でも制限に巻き込まれない', function () {
    for ($i = 1; $i <= 6; $i++) {
        fromFrontend()->postJson('/api/login', ['email' => 'other@example.com', 'password' => 'wrong']);
    }

    fromFrontend()->postJson('/api/login', ['email' => 'taro@example.com', 'password' => 'password123'])
        ->assertOk();
});
