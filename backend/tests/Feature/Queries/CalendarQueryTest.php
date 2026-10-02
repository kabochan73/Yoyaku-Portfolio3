<?php

declare(strict_types=1);

use App\Booking\BookingRules;
use App\Enums\DayClosedReason;
use App\Enums\SlotStatus;
use App\Models\Holiday;
use App\Models\RegularHoliday;
use App\Models\Reservation;
use App\Queries\CalendarDay;
use App\Queries\CalendarFacts;
use App\Queries\CalendarQuery;
use App\Queries\CalendarSlot;
use Carbon\CarbonImmutable;

/*
 * CalendarQuery::forPublic()（公開のカレンダーの組み立て）のテスト。
 *
 * 「今」は 2026-10-06（火）15:00 に固定して渡す。予約できる最終日は 1か月後の 2026-11-06（金）。
 * 2026-10-05 は月曜、2026-10-12 も月曜。月曜を定休日にしておく。
 */

beforeEach(function () {
    RegularHoliday::query()->create(['day_of_week' => 1]);
    $this->now = CarbonImmutable::parse('2026-10-06 15:00');
});

/**
 * forPublic の結果を [日付 => CalendarDay] にする（日付で引けるように）。
 *
 * @return array<string, CalendarDay>
 */
function publicCalendar(string $from, string $to, CarbonImmutable $now, ?CalendarQuery $query = null): array
{
    $days = ($query ?? app(CalendarQuery::class))
        ->forPublic(CarbonImmutable::parse($from), CarbonImmutable::parse($to), $now);

    $byDate = [];
    foreach ($days as $day) {
        $byDate[$day->date->toDateString()] = $day;
    }

    return $byDate;
}

/**
 * 枠を [時 => 状態の文字列] にする（比べやすいように）。
 *
 * @return array<int, string>
 */
function slotStatuses(CalendarDay $day): array
{
    $statuses = [];
    foreach ($day->slots as $slot) {
        $statuses[$slot->hour] = $slot->status->value;
    }

    return $statuses;
}

it('期間の全部の日を、日付の順に返す', function () {
    $days = app(CalendarQuery::class)->forPublic(
        CarbonImmutable::parse('2026-10-05'),
        CarbonImmutable::parse('2026-10-11'),
        $this->now,
    );

    expect(array_map(fn (CalendarDay $day): string => $day->date->toDateString(), $days))
        ->toBe(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
});

it('日の受付外の理由を、過去 → 期間外 → 定休日 → 臨時休業日 の順で決める', function () {
    Holiday::query()->create(['date' => '2026-10-08']);
    // 定休日（月曜）にも臨時休業日を登録しておく → 定休日が優先
    Holiday::query()->create(['date' => '2026-10-12']);
    // 予約期間外の日にも臨時休業日を登録しておく → 期間外が優先
    Holiday::query()->create(['date' => '2026-11-09']);

    $days = publicCalendar('2026-10-05', '2026-11-09', $this->now);

    expect($days['2026-10-05']->closedReason)->toBe(DayClosedReason::Past)            // 過去の月曜 → 過去が優先
        ->and($days['2026-10-06']->closedReason)->toBeNull()                          // 今日
        ->and($days['2026-10-07']->closedReason)->toBeNull()
        ->and($days['2026-10-08']->closedReason)->toBe(DayClosedReason::Holiday)
        ->and($days['2026-10-12']->closedReason)->toBe(DayClosedReason::RegularHoliday)
        ->and($days['2026-11-09']->closedReason)->toBe(DayClosedReason::OutOfRange);
});

it('予約できる最終日（1か月後の同日）までは受付中で、その翌日からは期間外', function () {
    $days = publicCalendar('2026-11-06', '2026-11-07', $this->now);

    expect($days['2026-11-06']->closedReason)->toBeNull()
        ->and($days['2026-11-07']->closedReason)->toBe(DayClosedReason::OutOfRange);
});

it('受付中の日は、営業時間の1時間ごとの枠を返す', function () {
    $days = publicCalendar('2026-10-07', '2026-10-07', $this->now);

    // 10〜21時の12枠（22時は営業終了なので枠が無い）
    expect(array_keys(slotStatuses($days['2026-10-07'])))->toBe(range(10, 21))
        ->and(array_unique(slotStatuses($days['2026-10-07'])))->toBe([10 => 'available']);
});

it('今日の始まった枠は過去。開始時刻ちょうども過去（B10）', function () {
    $days = publicCalendar('2026-10-06', '2026-10-06', $this->now);

    $statuses = slotStatuses($days['2026-10-06']);

    // 今は 15:00 ちょうど → 15時の枠も過去
    expect($statuses[14])->toBe('past')
        ->and($statuses[15])->toBe('past')
        ->and($statuses[16])->toBe('available');
});

it('確定済みの予約が入っている枠は予約済み。過去より先に判定する', function () {
    Reservation::factory()->on('2026-10-07', 12, 14)->create();
    // 今日の、もう終わった予約
    Reservation::factory()->on('2026-10-06', 10, 12)->create();
    // キャンセル済みは関係ない
    Reservation::factory()->on('2026-10-07', 18, 20)->cancelled()->create();

    $days = publicCalendar('2026-10-06', '2026-10-07', $this->now);

    expect(slotStatuses($days['2026-10-07']))->toMatchArray([11 => 'available', 12 => 'booked', 13 => 'booked', 14 => 'available', 18 => 'available'])
        ->and(slotStatuses($days['2026-10-06']))->toMatchArray([10 => 'booked', 11 => 'booked', 12 => 'past']);
});

it('受付外の日は、予約があっても枠を返さない（予約の有無を見せない）', function () {
    Reservation::factory()->on('2026-10-08', 12, 14)->create();
    // 予約の後に臨時休業日を登録した（手順7では予約も一緒にキャンセルされるが、ここでは残っている）
    Holiday::query()->create(['date' => '2026-10-08']);

    $days = publicCalendar('2026-10-08', '2026-10-08', $this->now);

    expect($days['2026-10-08']->slots)->toBe([]);
});

it('営業時間は BookingRules（config/facility.php）に従う', function () {
    $query = new CalendarQuery(
        app(CalendarFacts::class),
        new BookingRules(openHour: 9, closeHour: 12, minHours: 1, maxHours: 2, bookingWindowMonths: 1),
    );

    $days = publicCalendar('2026-10-07', '2026-10-07', $this->now, $query);

    expect($days['2026-10-07']->slots)->toEqual([
        new CalendarSlot(9, SlotStatus::Available),
        new CalendarSlot(10, SlotStatus::Available),
        new CalendarSlot(11, SlotStatus::Available),
    ]);
});
