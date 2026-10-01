<?php

declare(strict_types=1);

use App\Enums\DayClosedReason;
use App\Models\Holiday;
use App\Models\RegularHoliday;
use App\Queries\ClosedDays;
use Carbon\CarbonImmutable;

/*
 * ClosedDays（予約時に DB を見て、定休日・臨時休業日かを判定する）のテスト。
 * 2026-10-12 は月曜、2026-10-13 は火曜。
 */

beforeEach(function () {
    RegularHoliday::query()->create(['day_of_week' => 1]); // 月曜が定休日
});

it('DB の定休日・臨時休業日で判定する', function () {
    Holiday::query()->create(['date' => '2026-10-13', 'reason' => '設備点検']);

    $closedDays = app(ClosedDays::class);

    expect($closedDays->reasonFor(CarbonImmutable::parse('2026-10-12')))->toBe(DayClosedReason::RegularHoliday)
        ->and($closedDays->reasonFor(CarbonImmutable::parse('2026-10-13')))->toBe(DayClosedReason::Holiday)
        ->and($closedDays->reasonFor(CarbonImmutable::parse('2026-10-14')))->toBeNull();
});

it('臨時休業日を登録した直後から、判定に反映される（キャッシュを通していない）', function () {
    $closedDays = app(ClosedDays::class);
    $date = CarbonImmutable::parse('2026-10-14');

    expect($closedDays->reasonFor($date))->toBeNull();

    Holiday::query()->create(['date' => '2026-10-14']);

    expect($closedDays->reasonFor($date))->toBe(DayClosedReason::Holiday);
});

it('定休日を外した直後から、判定に反映される', function () {
    $closedDays = app(ClosedDays::class);
    $monday = CarbonImmutable::parse('2026-10-12');

    RegularHoliday::query()->delete();

    expect($closedDays->reasonFor($monday))->toBeNull();
});
