<?php

declare(strict_types=1);

use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;

/*
 * GET /api/user/reservations（自分の今日以降の予約）のテスト。
 * 今を 2026-10-06（火）13:00 に固定する。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 13:00', 'Asia/Tokyo'));
    $this->user = User::factory()->create(['name' => '山田太郎']);
});

it('自分の予約を、決まった形で返す', function () {
    $reservation = Reservation::factory()->for($this->user)->on('2026-10-08', 12, 14)->create(['price' => 8000]);

    $this->actingAs($this->user)
        ->getJson('/api/user/reservations')
        ->assertOk()
        ->assertExactJson([
            'data' => [[
                'id' => $reservation->id,
                'date' => '2026-10-08',
                'start_hour' => 12,
                'end_hour' => 14,
                'hours' => 2,
                'price' => 8000,
                'status' => 'confirmed',
                'phase' => 'before_start',
                'is_cancellable' => true,
                'booker_name' => '山田太郎',
            ]],
        ]);
});

it('他人の予約・キャンセル済み・昨日以前の予約は入れない', function () {
    $mine = Reservation::factory()->for($this->user)->on('2026-10-08', 12, 14)->create();
    Reservation::factory()->on('2026-10-09', 12, 14)->create();                                  // 他人
    Reservation::factory()->for($this->user)->on('2026-10-10', 12, 14)->cancelled()->create();   // キャンセル済み
    Reservation::factory()->for($this->user)->on('2026-10-05', 12, 14)->create();                // 昨日

    $this->actingAs($this->user)
        ->getJson('/api/user/reservations')
        ->assertOk()
        ->assertJsonPath('data.*.id', [$mine->id]);
});

it('日付・開始時刻の順に並べる', function () {
    // 1人1日1件なので、別の日に入れる
    $later = Reservation::factory()->for($this->user)->on('2026-10-09', 10, 12)->create();
    $earlier = Reservation::factory()->for($this->user)->on('2026-10-07', 18, 20)->create();

    $this->actingAs($this->user)
        ->getJson('/api/user/reservations')
        ->assertJsonPath('data.*.id', [$earlier->id, $later->id]);
});

it('今日の始まった予約も入れ、段階は利用中・キャンセルはできない（docs/08 の 5.2）', function () {
    // 今は 13:00。12〜14時の予約は利用中
    Reservation::factory()->for($this->user)->on('2026-10-06', 12, 14)->create();

    $this->actingAs($this->user)
        ->getJson('/api/user/reservations')
        ->assertJsonPath('data.0.phase', 'in_use')
        ->assertJsonPath('data.0.is_cancellable', false);
});

it('今日の終わった予約は、段階が終了', function () {
    Reservation::factory()->for($this->user)->on('2026-10-06', 10, 12)->create();

    $this->actingAs($this->user)
        ->getJson('/api/user/reservations')
        ->assertJsonPath('data.0.phase', 'finished')
        ->assertJsonPath('data.0.is_cancellable', false);
});

it('未ログインなら 401', function () {
    fromFrontend()->getJson('/api/user/reservations')
        ->assertUnauthorized()
        ->assertJson(['code' => 'unauthenticated']);
});
