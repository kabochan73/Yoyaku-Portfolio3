<?php

declare(strict_types=1);

use App\Models\User;

/*
 * GET /api/user（ログイン中のユーザー）のテスト。
 */

it('ログイン中なら、ユーザーを決まった形で返す', function () {
    $user = User::factory()->create(['name' => '山田太郎', 'email' => 'taro@example.com']);

    $this->actingAs($user)
        ->getJson('/api/user')
        ->assertOk()
        ->assertExactJson([
            'data' => [
                'id' => $user->id,
                'name' => '山田太郎',
                'email' => 'taro@example.com',
                'role' => 'user',
            ],
        ]);
});

it('パスワードのハッシュなど、決めた以外の項目は返さない（D4）', function () {
    $response = $this->actingAs(User::factory()->create())->getJson('/api/user');

    expect(array_keys($response->json('data')))->toBe(['id', 'name', 'email', 'role']);
});

it('管理者なら role は admin', function () {
    $this->actingAs(User::factory()->admin()->create())
        ->getJson('/api/user')
        ->assertJsonPath('data.role', 'admin');
});

it('未ログインなら 401', function () {
    fromFrontend()->getJson('/api/user')
        ->assertUnauthorized()
        ->assertJson(['code' => 'unauthenticated']);
});
