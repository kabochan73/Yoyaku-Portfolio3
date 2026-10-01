<?php

declare(strict_types=1);

/*
 * B12: 中継元（Next.js・nginx）を信用して、利用者の本当の IP を取ること。
 * あわせて、すべての API に付けた回数制限 'api' を確かめる。
 *
 * REMOTE_ADDR は「Laravel に直接つないできた相手」の IP。
 * 本番・ローカルでは、これが内部ネットワークの Next.js（nginx 経由）になる。
 */

it('内部ネットワークから来たら、X-Forwarded-For の IP を利用者の IP とみなす', function () {
    // Docker の Next.js のコンテナ（172.18.0.9）から、利用者 203.0.113.9 のリクエストが中継されてきた想定
    $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.9'])
        ->withHeader('X-Forwarded-For', '203.0.113.9')
        ->getJson('/api/debug/ip')
        ->assertOk()
        ->assertJson(['ip' => '203.0.113.9', 'x_forwarded_for' => '203.0.113.9']);
});

it('Railway のプライベートネットワーク（IPv6 の fd12::）からも信用する', function () {
    $this->withServerVariables(['REMOTE_ADDR' => 'fd12::10'])
        ->withHeader('X-Forwarded-For', '203.0.113.9')
        ->getJson('/api/debug/ip')
        ->assertJson(['ip' => '203.0.113.9']);
});

it('外から直接来た X-Forwarded-For は信用しない（なりすましを防ぐ）', function () {
    // 8.8.8.8 の利用者が、自分で X-Forwarded-For を書いて別人（203.0.113.9）になりすまそうとした想定
    $this->withServerVariables(['REMOTE_ADDR' => '8.8.8.8'])
        ->withHeader('X-Forwarded-For', '203.0.113.9')
        ->getJson('/api/debug/ip')
        ->assertJson(['ip' => '8.8.8.8']);
});

it('確認用の口は、ローカル・テスト以外では、環境変数で有効にしない限り 404', function () {
    app()->detectEnvironment(fn () => 'production');

    $this->getJson('/api/debug/ip')->assertNotFound();

    config(['app.debug_ip_endpoint' => true]);
    $this->getJson('/api/debug/ip')->assertOk();
});

it("回数制限 'api': 同じ IP から 1分に60回までは通り、61回目は 429", function () {
    $request = fn () => $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.9'])
        ->withHeader('X-Forwarded-For', '203.0.113.9')
        ->getJson('/api/debug/ip');

    for ($i = 1; $i <= 60; $i++) {
        $request()->assertOk();
    }

    $request()->assertStatus(429)->assertJson(['code' => 'too_many_requests']);
});

it("回数制限 'api': 利用者の IP ごとに数える（中継元が同じでも、別の利用者は巻き込まない）", function () {
    // 203.0.113.9 が制限に当たっても……
    for ($i = 1; $i <= 61; $i++) {
        $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.9'])
            ->withHeader('X-Forwarded-For', '203.0.113.9')
            ->getJson('/api/debug/ip');
    }

    // 同じ Next.js 経由の別の利用者（198.51.100.7）は通る。
    // B12 の対策が無いと、全員が Next.js のコンテナの IP として数えられ、ここで 429 になる
    $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.9'])
        ->withHeader('X-Forwarded-For', '198.51.100.7')
        ->getJson('/api/debug/ip')
        ->assertOk();
});
