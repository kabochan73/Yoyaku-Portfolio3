<?php

declare(strict_types=1);

use App\Enums\PriceType;
use App\Enums\ReservationStatus;
use App\Models\Price;
use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;

/*
 * POST /api/reservations/{reservation}/cancel（自分の予約をキャンセルする）のテスト。docs/06 の「キャンセル（B4）」。
 * キャンセルできる状態かの細かい場合分けは CancelReservationTest で確かめている。
 * 今を 2026-10-06（火）15:00 に固定する。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Tokyo'));
    $this->user = User::factory()->create(['name' => '山田太郎']);
});

it('本人の予約なら 200 で、キャンセル済みの予約を返す', function () {
    $reservation = Reservation::factory()->for($this->user)->on('2026-10-07', 12, 14)->create();

    $this->actingAs($this->user)
        ->postJson("/api/reservations/{$reservation->id}/cancel")
        ->assertOk()
        ->assertJsonPath('data.id', $reservation->id)
        ->assertJsonPath('data.status', 'cancelled')
        ->assertJsonPath('data.is_cancellable', false);

    expect($reservation->fresh()?->status)->toBe(ReservationStatus::Cancelled);
});

it('他人の予約は 403 で、キャンセルされない', function () {
    $others = Reservation::factory()->on('2026-10-07', 12, 14)->create();

    $this->actingAs($this->user)
        ->postJson("/api/reservations/{$others->id}/cancel")
        ->assertForbidden()
        ->assertJson(['code' => 'forbidden']);

    expect($others->fresh()?->status)->toBe(ReservationStatus::Confirmed);
});

it('管理者でも、会員用のルートでは他人の予約は 403（理由が「会員によるキャンセル」になるのを防ぐ）', function () {
    $others = Reservation::factory()->on('2026-10-07', 12, 14)->create();

    $this->actingAs(User::factory()->admin()->create())
        ->postJson("/api/reservations/{$others->id}/cancel")
        ->assertForbidden();
});

it('キャンセル済みの予約は 409 reservation_not_cancellable', function () {
    $reservation = Reservation::factory()->for($this->user)->on('2026-10-07', 12, 14)->cancelled()->create();

    $this->actingAs($this->user)
        ->postJson("/api/reservations/{$reservation->id}/cancel")
        ->assertConflict()
        ->assertExactJson([
            'message' => 'この予約はキャンセルできません（開始済み、またはキャンセル済み）。',
            'code' => 'reservation_not_cancellable',
        ]);
});

it('無い予約は 404', function () {
    $this->actingAs($this->user)
        ->postJson('/api/reservations/999999/cancel')
        ->assertNotFound()
        ->assertJson(['code' => 'not_found']);
});

it('未ログインなら 401', function () {
    $reservation = Reservation::factory()->for($this->user)->on('2026-10-07', 12, 14)->create();

    fromFrontend()
        ->postJson("/api/reservations/{$reservation->id}/cancel")
        ->assertUnauthorized();
});

it('キャンセルした後は、同じ日にもう一度予約できる（1人1日1件はキャンセル済みを数えない）', function () {
    Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => 4000]);
    Price::query()->create(['type' => PriceType::Weekend, 'amount_per_hour' => 5000]);
    $reservation = Reservation::factory()->for($this->user)->on('2026-10-07', 12, 14)->create();

    $this->actingAs($this->user)->postJson("/api/reservations/{$reservation->id}/cancel")->assertOk();
    nextRequest();

    $this->actingAs($this->user)
        ->postJson('/api/reservations', ['date' => '2026-10-07', 'start_hour' => 18, 'end_hour' => 20])
        ->assertCreated();
});
