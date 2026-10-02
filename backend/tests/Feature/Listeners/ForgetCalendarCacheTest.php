<?php

declare(strict_types=1);

use App\Enums\PriceType;
use App\Events\HolidayChanged;
use App\Events\ReservationCancelled;
use App\Events\ReservationCreated;
use App\Listeners\ForgetCalendarCache;
use App\Models\Holiday;
use App\Models\Price;
use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;

/*
 * ForgetCalendarCache（予約・キャンセルの後に、その日のカレンダーのキャッシュを消す）のテスト。
 * docs/06 の「カレンダーのキャッシュ」: 予約・キャンセルの後、その日のキャッシュが消えて次の /calendar に反映される。
 * ほかの日のキャッシュは残る。
 *
 * 今を 2026-10-06（火）15:00 に固定する。2026-10-07 は水曜。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Tokyo'));
    Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => 4000]);
    Price::query()->create(['type' => PriceType::Weekend, 'amount_per_hour' => 5000]);
    $this->user = User::factory()->create();
});

/** 10/7 の12時の枠の状態を、カレンダー API から読む */
function slotAtNoon(): string
{
    nextRequest();

    return test()->getJson('/api/calendar?from=2026-10-07&to=2026-10-08')->json('data.0.slots.2.status');
}

it('予約・キャンセルのイベントを受けるよう登録されている', function () {
    Event::fake();

    Event::assertListening(ReservationCreated::class, ForgetCalendarCache::class);
    Event::assertListening(ReservationCancelled::class, ForgetCalendarCache::class);
    Event::assertListening(HolidayChanged::class, ForgetCalendarCache::class);
});

it('予約した直後のカレンダーで、その枠が予約済みになる（60秒待たない）', function () {
    // カレンダーを見て、10/7 の事実（予約なし）をキャッシュに入れる
    expect(slotAtNoon())->toBe('available');

    nextRequest();
    $this->actingAs($this->user)
        ->postJson('/api/reservations', ['date' => '2026-10-07', 'start_hour' => 12, 'end_hour' => 14])
        ->assertCreated();

    expect(slotAtNoon())->toBe('booked');
});

it('キャンセルした直後のカレンダーで、その枠が空きに戻る', function () {
    $reservation = Reservation::factory()->for($this->user)->on('2026-10-07', 12, 14)->create();
    expect(slotAtNoon())->toBe('booked');

    nextRequest();
    $this->actingAs($this->user)->postJson("/api/reservations/{$reservation->id}/cancel")->assertOk();

    expect(slotAtNoon())->toBe('available');
});

it('消すのはその日のキャッシュだけで、ほかの日は残す', function () {
    // 10/7・10/8 の事実をキャッシュに入れる
    slotAtNoon();

    nextRequest();
    $this->actingAs($this->user)
        ->postJson('/api/reservations', ['date' => '2026-10-07', 'start_hour' => 12, 'end_hour' => 14])
        ->assertCreated();

    expect(Cache::has('calendar:day:2026-10-07'))->toBeFalse()
        ->and(Cache::has('calendar:day:2026-10-08'))->toBeTrue();
});

it('臨時休業日を登録した直後のカレンダーで、その日が休業日になり、解除すると戻る', function () {
    $admin = User::factory()->admin()->create();
    // 10/7・10/8 の事実をキャッシュに入れる
    expect(slotAtNoon())->toBe('available');

    nextRequest();
    $this->actingAs($admin)->postJson('/api/admin/holidays', ['date' => '2026-10-07'])->assertCreated();

    nextRequest();
    $this->getJson('/api/calendar?from=2026-10-07&to=2026-10-08')
        ->assertJsonPath('data.0.closed_reason', 'holiday');
    // ほかの日（10/8）のキャッシュは残す
    expect(Cache::has('calendar:day:2026-10-08'))->toBeTrue();

    nextRequest();
    $holiday = Holiday::query()->sole();
    $this->actingAs($admin)->deleteJson("/api/admin/holidays/{$holiday->id}")->assertNoContent();

    expect(slotAtNoon())->toBe('available');
});
