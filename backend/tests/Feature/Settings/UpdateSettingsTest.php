<?php

declare(strict_types=1);

use App\Actions\Settings\UpdatePrices;
use App\Actions\Settings\UpdateRegularHolidays;
use App\Enums\PriceType;
use App\Events\FacilityChanged;
use App\Models\Price;
use App\Models\RegularHoliday;
use App\Models\Reservation;
use Illuminate\Support\Facades\Event;

/*
 * UpdatePrices・UpdateRegularHolidays（料金・定休日の変更）のテスト。
 */

beforeEach(function () {
    Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => 4000]);
    Price::query()->create(['type' => PriceType::Weekend, 'amount_per_hour' => 5000]);
    Event::fake([FacilityChanged::class]);
});

it('料金を変え、FacilityChanged を出す', function () {
    app(UpdatePrices::class)->handle(weekday: 4500, weekend: 6000);

    $table = Price::table();
    expect($table->weekday)->toBe(4500)
        ->and($table->weekend)->toBe(6000);
    Event::assertDispatched(FacilityChanged::class);
});

it('料金を変えても、すでに入っている予約の金額は変えない（R9）', function () {
    $reservation = Reservation::factory()->phone()->on('2026-10-07', 12, 14)->create(['price' => 8000]);

    app(UpdatePrices::class)->handle(weekday: 9000, weekend: 9000);

    expect($reservation->fresh()?->price)->toBe(8000);
});

it('定休日を渡された曜日に置き換え、FacilityChanged を出す', function () {
    RegularHoliday::query()->create(['day_of_week' => 1]);

    app(UpdateRegularHolidays::class)->handle([0, 3]);

    expect(RegularHoliday::days())->toBe([0, 3]);
    Event::assertDispatched(FacilityChanged::class);
});

it('空の一覧なら、定休日なしにする', function () {
    RegularHoliday::query()->create(['day_of_week' => 1]);

    app(UpdateRegularHolidays::class)->handle([]);

    expect(RegularHoliday::days())->toBe([]);
});

it('定休日を変えても、その曜日の予約はキャンセルしない（docs/01 の 6.3）', function () {
    // 2026-10-07 は水曜
    $reservation = Reservation::factory()->phone()->on('2026-10-07', 12, 14)->create();

    app(UpdateRegularHolidays::class)->handle([3]);

    expect($reservation->fresh()?->status->value)->toBe('confirmed');
});
