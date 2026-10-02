<?php

declare(strict_types=1);

use App\Models\Reservation;
use App\Models\User;

/*
 * GET /api/admin/users?search=（会員検索）のテスト（docs/03・docs/01 の 6.5）。
 */

beforeEach(function () {
    $this->admin = User::factory()->admin()->create(['name' => '管理者', 'email' => 'admin@example.com']);
});

/** 検索して、見つかった人の名前の一覧を返す */
function searchNames(string $search): array
{
    return test()->actingAs(test()->admin)
        ->getJson('/api/admin/users?search='.urlencode($search))
        ->assertOk()
        ->json('data.*.name');
}

it('名前の一部・メールアドレスの一部で見つかり、決まった形で返す', function () {
    $taro = User::factory()->create(['name' => '山田太郎', 'email' => 'taro@example.com']);
    User::factory()->create(['name' => '鈴木花子', 'email' => 'hanako@example.com']);

    $this->actingAs($this->admin)
        ->getJson('/api/admin/users?search='.urlencode('山田'))
        ->assertOk()
        ->assertExactJson([
            'data' => [[
                'id' => $taro->id,
                'name' => '山田太郎',
                'email' => 'taro@example.com',
                'confirmed_reservations_count' => 0,
            ]],
            'meta' => ['limit' => 20],
        ]);

    expect(searchNames('hanako'))->toBe(['鈴木花子']);
});

it('大文字・小文字を区別しない', function () {
    User::factory()->create(['name' => 'Taro Yamada', 'email' => 'taro@example.com']);

    expect(searchNames('TARO'))->toBe(['Taro Yamada'])
        ->and(searchNames('yamada'))->toBe(['Taro Yamada']);
});

it('% と _ はただの文字として探す（R1 は「_」で全員が出た）', function () {
    User::factory()->create(['name' => '山田太郎', 'email' => 'taro@example.com']);
    User::factory()->create(['name' => 'under_score', 'email' => 'under@example.com']);
    User::factory()->create(['name' => '100%会員', 'email' => 'percent@example.com']);

    expect(searchNames('_'))->toBe(['under_score'])
        ->and(searchNames('%'))->toBe(['100%会員']);
});

it('管理者は出さない', function () {
    expect(searchNames('admin'))->toBe([]);
});

it('予約件数は、確定済みの予約だけを数える', function () {
    $taro = User::factory()->create(['name' => '山田太郎']);
    Reservation::factory()->for($taro)->on('2026-10-07', 10, 12)->create();
    Reservation::factory()->for($taro)->on('2026-10-08', 10, 12)->create();
    Reservation::factory()->for($taro)->on('2026-10-09', 10, 12)->cancelled()->create();

    $this->actingAs($this->admin)
        ->getJson('/api/admin/users?search='.urlencode('山田'))
        ->assertJsonPath('data.0.confirmed_reservations_count', 2);
});

it('最大20人まで、名前の順に返す。問い合わせの回数は人数で増えない', function () {
    foreach (range(1, 21) as $i) {
        $user = User::factory()->create(['name' => sprintf('会員%02d', 22 - $i), 'email' => "member{$i}@example.com"]);
        // 同じ時間帯に重ねると二重予約の制約に当たるので、人ごとに日付を変える
        Reservation::factory()->for($user)->on(sprintf('2026-11-%02d', $i), 10, 12)->create();
    }

    nextRequest();
    $queries = countQueries(function () use (&$names) {
        $names = searchNames('会員');
    });

    expect($names)->toHaveCount(20)
        ->and($names[0])->toBe('会員01')
        ->and($names[19])->toBe('会員20');
    // ログインの確認などを含めても、少ない回数で済んでいる（人数分の問い合わせになっていない）
    expect($queries)->toBeLessThan(5);
});

it('search が無い・長すぎると 422', function (string $query) {
    $this->actingAs($this->admin)
        ->getJson("/api/admin/users{$query}")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['search']);
})->with([
    '無い' => [''],
    '空' => ['?search='],
    '256文字' => ['?search='.str_repeat('a', 256)],
]);

it('会員は 403', function () {
    $this->actingAs(User::factory()->create())
        ->getJson('/api/admin/users?search=a')
        ->assertForbidden();
});
