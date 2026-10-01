<?php

declare(strict_types=1);

use App\Models\User;

/*
 * ログアウト（POST /api/logout）のテスト。
 */

it('ログアウトすると 204 で、その後は /api/user が 401 になる', function () {
    User::factory()->create(['email' => 'taro@example.com', 'password' => 'password123']);

    fromFrontend()->postJson('/api/login', ['email' => 'taro@example.com', 'password' => 'password123'])->assertOk();

    nextRequest();
    fromFrontend()->postJson('/api/logout')->assertNoContent();

    nextRequest();
    fromFrontend()->getJson('/api/user')->assertUnauthorized();
});

it('ログインしていないのにログアウトすると 401', function () {
    fromFrontend()->postJson('/api/logout')
        ->assertUnauthorized()
        ->assertJsonPath('code', 'unauthenticated');
});
