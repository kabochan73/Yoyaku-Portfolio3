<?php

declare(strict_types=1);

use App\Enums\DayClosedReason;
use App\Enums\SlotStatus;
use App\Models\Holiday;
use App\Models\RegularHoliday;
use App\Models\Reservation;
use App\Queries\AdminCalendarDay;
use App\Queries\CalendarQuery;
use Carbon\CarbonImmutable;

/*
 * CalendarQuery::forAdmin()（管理者用のカレンダーの組み立て）のテスト。docs/06 の「管理カレンダー（B11）」。
 *
 * 今を 2026-10-06（火）15:00 に固定する。月曜が定休日（2026-10-05・10-12 は月曜）。
 * 予約を残しているのは 3か月前の 2026-07-06 から。
 */

beforeEach(function () {
    RegularHoliday::query()->create(['day_of_week' => 1]);
    $this->now = CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Tokyo');
});

/**
 * forAdmin の結果を [日付 => AdminCalendarDay] にする。
 *
 * @return array<string, AdminCalendarDay>
 */
function adminCalendar(string $from, string $to, CarbonImmutable $now): array
{
    $byDate = [];
    foreach (app(CalendarQuery::class)->forAdmin(CarbonImmutable::parse($from), CarbonImmutable::parse($to), $now) as $day) {
        $byDate[$day->date->toDateString()] = $day;
    }

    return $byDate;
}

/**
 * 枠を [時 => 状態の文字列] にする。
 *
 * @return array<int, string>
 */
function adminStatuses(AdminCalendarDay $day): array
{
    $statuses = [];
    foreach ($day->slots as $slot) {
        $statuses[$slot->hour] = $slot->status->value;
    }

    return $statuses;
}

it('B11: 定休日に残った予約は booked（予約の id 付き）で出し、ほかの枠は closed', function () {
    // 定休日（月曜）の 10/12 に、定休日にする前から入っていた予約
    $reservation = Reservation::factory()->on('2026-10-12', 18, 20)->create();

    $day = adminCalendar('2026-10-12', '2026-10-12', $this->now)['2026-10-12'];

    expect($day->closedReason)->toBe(DayClosedReason::RegularHoliday)
        ->and($day->slots)->toHaveCount(12)
        ->and(adminStatuses($day))->toMatchArray([10 => 'closed', 17 => 'closed', 18 => 'booked', 19 => 'booked', 20 => 'closed'])
        ->and($day->slots[8]->reservationId)->toBe($reservation->id)
        ->and($day->slots[0]->reservationId)->toBeNull()
        ->and(array_map(fn (Reservation $r): int => $r->id, $day->reservations))->toBe([$reservation->id]);
});

it('臨時休業日・過去の日も、予約がある枠は booked で出す（実績の確認・キャンセルのため）', function () {
    Holiday::query()->create(['date' => '2026-10-08']);
    Reservation::factory()->on('2026-10-08', 12, 14)->create();
    Reservation::factory()->on('2026-10-02', 10, 12)->create(); // 過去の金曜

    $days = adminCalendar('2026-10-02', '2026-10-08', $this->now);

    expect(adminStatuses($days['2026-10-08']))->toMatchArray([11 => 'closed', 12 => 'booked', 13 => 'booked'])
        ->and(adminStatuses($days['2026-10-02']))->toMatchArray([10 => 'booked', 11 => 'booked', 12 => 'closed']);
});

it('受付中の日は、公開用と同じく 予約済み → 過去 → 空き。予約済みの枠に id を付ける', function () {
    $reservation = Reservation::factory()->on('2026-10-06', 10, 12)->create();

    $day = adminCalendar('2026-10-06', '2026-10-06', $this->now)['2026-10-06'];

    // 今は 15:00
    expect($day->closedReason)->toBeNull()
        ->and(adminStatuses($day))->toMatchArray([10 => 'booked', 12 => 'past', 15 => 'past', 16 => 'available'])
        ->and($day->slots[0]->reservationId)->toBe($reservation->id);
});

it('2枠以上の予約も、予約の一覧には1回だけ入れる。電話予約と会員の予約を区別できる', function () {
    $member = Reservation::factory()->on('2026-10-07', 10, 14)->create();
    $phone = Reservation::factory()->phone()->on('2026-10-07', 18, 20)->create();

    $day = adminCalendar('2026-10-07', '2026-10-07', $this->now)['2026-10-07'];

    expect($day->reservations)->toHaveCount(2)
        ->and($day->reservations[0]->id)->toBe($member->id)
        ->and($day->reservations[0]->user_id)->toBe($member->user_id)
        ->and($day->reservations[1]->id)->toBe($phone->id)
        ->and($day->reservations[1]->user_id)->toBeNull();
});

it('キャンセル済みの予約は出さない', function () {
    Reservation::factory()->on('2026-10-07', 10, 12)->cancelled()->create();

    $day = adminCalendar('2026-10-07', '2026-10-07', $this->now)['2026-10-07'];

    expect($day->reservations)->toBe([])
        ->and(array_unique(adminStatuses($day)))->toBe([10 => 'available']);
});

it('保持期間（3か月）: 7/6 までは出し、それより前の日は枠も予約も空', function () {
    Reservation::factory()->on('2026-07-06', 10, 12)->create();
    Reservation::factory()->on('2026-07-03', 10, 12)->create();

    $days = adminCalendar('2026-07-03', '2026-07-06', $this->now);

    expect($days['2026-07-06']->slots)->toHaveCount(12)
        ->and($days['2026-07-06']->reservations)->toHaveCount(1)
        ->and($days['2026-07-03']->slots)->toBe([])
        ->and($days['2026-07-03']->reservations)->toBe([]);
});

it('事実は公開用と同じキャッシュから読む（2回目は DB を読まない）', function () {
    app(CalendarQuery::class)->forPublic(CarbonImmutable::parse('2026-10-05'), CarbonImmutable::parse('2026-10-11'), $this->now);

    $queries = countQueries(fn () => adminCalendar('2026-10-05', '2026-10-11', $this->now));

    expect($queries)->toBe(0);
});

it('受付外の日の枠の状態 closed は、公開用のカレンダーでは使わない', function () {
    $days = app(CalendarQuery::class)->forPublic(CarbonImmutable::parse('2026-10-05'), CarbonImmutable::parse('2026-10-11'), $this->now);

    foreach ($days as $day) {
        foreach ($day->slots as $slot) {
            expect($slot->status)->not->toBe(SlotStatus::Closed)
                ->and($slot->reservationId)->toBeNull();
        }
    }
});
