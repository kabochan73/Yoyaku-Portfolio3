<?php

declare(strict_types=1);

use App\Enums\PriceType;
use App\Mail\ReservationConfirmedMail;
use App\Models\Price;
use App\Models\RegularHoliday;
use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;

/*
 * POST /api/admin/reservations（電話予約）のテスト。docs/06 の「電話予約」。
 * 会員の予約と同じルールを使うことと、電話予約だけの違いを確かめる。
 *
 * 今を 2026-10-06（火）15:00 に固定する。月曜が定休日。予約できる最終日は 2026-11-06。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Tokyo'));
    RegularHoliday::query()->create(['day_of_week' => 1]);
    Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => 4000]);
    Price::query()->create(['type' => PriceType::Weekend, 'amount_per_hour' => 5000]);
    $this->admin = User::factory()->admin()->create();
});

/** 電話予約を登録する */
function phoneBook(string $date, int $start, int $end, string $name = '電話 佐藤'): TestResponse
{
    return test()->actingAs(test()->admin)->postJson('/api/admin/reservations', [
        'date' => $date,
        'start_hour' => $start,
        'end_hour' => $end,
        'booker_name' => $name,
    ]);
}

it('電話予約を登録し、201 で is_phone が true の予約を返す', function () {
    phoneBook('2026-10-07', 12, 14)
        ->assertCreated()
        ->assertJsonPath('data.booker_name', '電話 佐藤')
        ->assertJsonPath('data.price', 8000)
        ->assertJsonPath('data.user_id', null)
        ->assertJsonPath('data.is_phone', true);

    expect(Reservation::query()->sole()->user_id)->toBeNull();
});

it('会員と同じルール違反は 422（1か月より先・定休日・短すぎる）', function (string $date, int $start, int $end, string $field) {
    phoneBook($date, $start, $end)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field]);
})->with([
    '1か月より先' => ['2026-11-07', 12, 14, 'date'],
    '定休日（月曜）' => ['2026-10-12', 12, 14, 'date'],
    '1時間' => ['2026-10-07', 12, 13, 'end_hour'],
    '開始時刻を過ぎた' => ['2026-10-06', 14, 16, 'start_hour'],
]);

it('重なる時間帯は 409 slot_taken（会員の予約とも重ならない）', function () {
    Reservation::factory()->on('2026-10-07', 13, 15)->create();

    phoneBook('2026-10-07', 12, 14)
        ->assertConflict()
        ->assertJson(['code' => 'slot_taken']);
});

it('1人1日1件の対象外: 同じ日に電話予約を2件作れる', function () {
    phoneBook('2026-10-07', 10, 12)->assertCreated();
    phoneBook('2026-10-07', 18, 20)->assertCreated();

    expect(Reservation::query()->whereDate('date', '2026-10-07')->count())->toBe(2);
});

it('電話予約には完了メールを送らない', function () {
    Mail::fake();

    phoneBook('2026-10-07', 12, 14)->assertCreated();

    Mail::assertNotSent(ReservationConfirmedMail::class);
});

it('登録した直後の公開カレンダーに、予約済みとして出る', function () {
    $this->getJson('/api/calendar?from=2026-10-07&to=2026-10-07')->assertJsonPath('data.0.slots.2.status', 'available');

    nextRequest();
    phoneBook('2026-10-07', 12, 14)->assertCreated();

    nextRequest();
    $this->getJson('/api/calendar?from=2026-10-07&to=2026-10-07')->assertJsonPath('data.0.slots.2.status', 'booked');
});

it('予約者名が無い・長すぎると 422', function (string $name) {
    phoneBook('2026-10-07', 12, 14, $name)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['booker_name']);
})->with([
    '空' => [''],
    '256文字' => [str_repeat('あ', 256)],
]);

it('会員は電話予約を登録できない（403）', function () {
    $this->actingAs(User::factory()->create())
        ->postJson('/api/admin/reservations', ['date' => '2026-10-07', 'start_hour' => 12, 'end_hour' => 14, 'booker_name' => 'x'])
        ->assertForbidden();
});
