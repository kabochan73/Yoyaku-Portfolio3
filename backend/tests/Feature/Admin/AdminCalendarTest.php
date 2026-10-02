<?php

declare(strict_types=1);

use App\Models\RegularHoliday;
use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;

/*
 * GET /api/admin/calendar（管理者用のカレンダー）のテスト。
 * 判定の細かい組み合わせは CalendarQueryAdminTest で確かめているので、ここでは API としての形と権限を見る。
 *
 * 今を 2026-10-06（火）15:00 に固定する。月曜が定休日（2026-10-12 は月曜）。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Tokyo'));
    RegularHoliday::query()->create(['day_of_week' => 1]);
    $this->admin = User::factory()->admin()->create();
});

const ADMIN_URL = '/api/admin/calendar?from=2026-10-12&to=2026-10-12';

it('決まった形で返す（枠に予約の id、予約の詳細は reservations に1回だけ）', function () {
    $member = User::factory()->create(['name' => '山田太郎']);
    $reservation = Reservation::factory()->for($member)->on('2026-10-12', 18, 20)->create(['price' => 8000]);

    $response = $this->actingAs($this->admin)->getJson(ADMIN_URL)->assertOk();

    expect($response->json('meta'))->toBe(['today' => '2026-10-06', 'bookable_until' => '2026-11-06'])
        ->and($response->json('data.0.date'))->toBe('2026-10-12')
        ->and($response->json('data.0.closed_reason'))->toBe('regular_holiday')
        ->and($response->json('data.0.slots.0'))->toBe(['hour' => 10, 'status' => 'closed', 'reservation_id' => null])
        ->and($response->json('data.0.slots.8'))->toBe(['hour' => 18, 'status' => 'booked', 'reservation_id' => $reservation->id])
        ->and($response->json('data.0.reservations'))->toBe([[
            'id' => $reservation->id,
            'date' => '2026-10-12',
            'start_hour' => 18,
            'end_hour' => 20,
            'hours' => 2,
            'price' => 8000,
            'status' => 'confirmed',
            'phase' => 'before_start',
            'is_cancellable' => true,
            'booker_name' => '山田太郎',
            'user_id' => $member->id,
            'is_phone' => false,
        ]]);
});

it('電話予約は is_phone が true', function () {
    Reservation::factory()->phone()->on('2026-10-12', 10, 12)->create();

    $this->actingAs($this->admin)->getJson(ADMIN_URL)
        ->assertJsonPath('data.0.reservations.0.is_phone', true)
        ->assertJsonPath('data.0.reservations.0.user_id', null);
});

it('B11: 公開用の /calendar では、定休日の予約は見えない（slots: []）', function () {
    Reservation::factory()->on('2026-10-12', 18, 20)->create();

    $this->getJson('/api/calendar?from=2026-10-12&to=2026-10-12')
        ->assertJsonPath('data.0.slots', [])
        ->assertJsonMissingPath('data.0.reservations');
});

it('未ログインは 401、会員は 403', function () {
    fromFrontend()->getJson(ADMIN_URL)->assertUnauthorized();

    $this->actingAs(User::factory()->create())
        ->getJson(ADMIN_URL)
        ->assertForbidden()
        ->assertJson(['code' => 'forbidden']);
});

it('入力チェックは /calendar と同じ（15日分は 422）', function () {
    $this->actingAs($this->admin)
        ->getJson('/api/admin/calendar?from=2026-10-05&to=2026-10-19')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['to']);
});

it('ETag を付け、中身が同じなら 304', function () {
    $etag = $this->actingAs($this->admin)->getJson(ADMIN_URL)->assertOk()->headers->get('ETag');

    $this->actingAs($this->admin)
        ->getJson(ADMIN_URL, ['If-None-Match' => $etag])
        ->assertStatus(304);
});
