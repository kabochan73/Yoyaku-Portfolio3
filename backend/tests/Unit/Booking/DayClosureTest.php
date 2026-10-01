<?php

declare(strict_types=1);

use App\Booking\DayClosure;
use App\Enums\DayClosedReason;
use Carbon\CarbonImmutable;

/*
 * DayClosure（定休日・臨時休業日の判定ルール）のテスト。
 * 2026-10-12 は月曜、2026-10-13 は火曜。
 */

it('定休日の曜日なら RegularHoliday', function () {
    expect(DayClosure::reason(CarbonImmutable::parse('2026-10-12'), [1], false))
        ->toBe(DayClosedReason::RegularHoliday);
});

it('臨時休業日なら Holiday', function () {
    expect(DayClosure::reason(CarbonImmutable::parse('2026-10-13'), [1], true))
        ->toBe(DayClosedReason::Holiday);
});

it('定休日と臨時休業日の両方に当たるときは、定休日を優先する', function () {
    expect(DayClosure::reason(CarbonImmutable::parse('2026-10-12'), [1], true))
        ->toBe(DayClosedReason::RegularHoliday);
});

it('どちらでもなければ null（営業日）', function () {
    expect(DayClosure::reason(CarbonImmutable::parse('2026-10-13'), [1], false))->toBeNull();
});

it('定休日なし（空の一覧）なら、月曜も営業日', function () {
    expect(DayClosure::reason(CarbonImmutable::parse('2026-10-12'), [], false))->toBeNull();
});

it('日曜は 0 として判定する（Carbon の dayOfWeek と同じ数え方）', function () {
    expect(DayClosure::reason(CarbonImmutable::parse('2026-10-11'), [0], false))
        ->toBe(DayClosedReason::RegularHoliday);
});
