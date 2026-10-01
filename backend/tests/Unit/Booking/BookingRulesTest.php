<?php

declare(strict_types=1);

use App\Booking\BookingRules;
use App\Booking\TimeSlot;
use App\Enums\DayClosedReason;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/*
 * BookingRules（予約のルール）のテスト。境界値を中心に確かめる（docs/06）。
 *
 * ルールは R2 の初期値と同じ: 営業 10〜22時・2〜4時間・1か月先まで。
 * 「今」は 2026-10-06（火）15:00。引数で渡すので、時刻を固定する仕組みは要らない。
 */

/** R2 の初期値のルール */
function rules(): BookingRules
{
    return new BookingRules(openHour: 10, closeHour: 22, minHours: 2, maxHours: 4, bookingWindowMonths: 1);
}

/** テストの「今」: 2026-10-06（火）15:00 */
function now15(): CarbonImmutable
{
    return CarbonImmutable::parse('2026-10-06 15:00');
}

/**
 * 時間帯を検査して、エラーになった項目とメッセージを返す（エラーが無ければ空の配列）。
 *
 * @return array<string, string>
 */
function violationsOf(TimeSlot $slot, ?CarbonImmutable $now = null): array
{
    try {
        rules()->assertValidSlot($slot, $now ?? now15());
    } catch (ValidationException $e) {
        // 項目ごとの最初のメッセージだけを取り出す
        return array_map(fn (array $messages): string => $messages[0], $e->errors());
    }

    return [];
}

describe('営業時間（10〜22時）', function () {
    it('境目を確かめる', function (int $start, int $end, bool $ok) {
        $errors = violationsOf(TimeSlot::on('2026-10-07', $start, $end));

        expect(array_key_exists('start_hour', $errors))->toBe(! $ok);
    })->with([
        '9〜11時（開始が営業前）' => [9, 11, false],
        '10〜12時（最初の枠から）' => [10, 12, true],
        '20〜22時（最後の枠まで）' => [20, 22, true],
        '21〜23時（終了が営業後）' => [21, 23, false],
    ]);

    it('メッセージに営業時間が入る', function () {
        expect(violationsOf(TimeSlot::on('2026-10-07', 9, 11))['start_hour'])
            ->toBe('営業時間（10:00〜22:00）の中で選んでください。');
    });
});

describe('利用時間（2〜4時間）', function () {
    it('境目を確かめる', function (int $start, int $end, bool $ok) {
        $errors = violationsOf(TimeSlot::on('2026-10-07', $start, $end));

        expect(array_key_exists('end_hour', $errors))->toBe(! $ok);
    })->with([
        '1時間' => [10, 11, false],
        '2時間' => [10, 12, true],
        '4時間' => [10, 14, true],
        '5時間' => [10, 15, false],
    ]);

    it('メッセージに時間の範囲が入る', function () {
        expect(violationsOf(TimeSlot::on('2026-10-07', 10, 11))['end_hour'])
            ->toBe('利用時間は2〜4時間で選んでください。');
    });
});

describe('予約できる期間（今日〜1か月後の同日）', function () {
    it('昨日は予約できない', function () {
        expect(violationsOf(TimeSlot::on('2026-10-05', 10, 12)))
            ->toBe(['date' => '過去の日付は予約できません。']);
    });

    it('1か月後の同日（11/6）は予約でき、その翌日（11/7）はできない', function () {
        expect(violationsOf(TimeSlot::on('2026-11-06', 10, 12)))->toBe([])
            ->and(violationsOf(TimeSlot::on('2026-11-07', 10, 12)))
            ->toBe(['date' => '11月6日より先は予約できません。']);
    });

    it('B13: 1/31 からは、2/28 まで予約でき、3/1 はできない（月末で溢れない）', function () {
        $now = CarbonImmutable::parse('2027-01-31 15:00');

        expect(violationsOf(TimeSlot::on('2027-02-28', 10, 12), $now))->toBe([])
            ->and(violationsOf(TimeSlot::on('2027-03-01', 10, 12), $now))->toHaveKey('date');
    });
});

describe('B10: 当日の過ぎた時刻', function () {
    it('15:00 に、当日の14時開始は予約できない', function () {
        expect(violationsOf(TimeSlot::on('2026-10-06', 14, 16)))
            ->toBe(['start_hour' => '開始時刻を過ぎています。']);
    });

    it('15:00 に、当日の15時開始（ちょうど今）も予約できない', function () {
        expect(violationsOf(TimeSlot::on('2026-10-06', 15, 17)))->toHaveKey('start_hour');
    });

    it('15:00 に、当日の16時開始は予約できる', function () {
        expect(violationsOf(TimeSlot::on('2026-10-06', 16, 18)))->toBe([]);
    });
});

it('違反が複数あれば、まとめてエラーにする', function () {
    // 営業時間外（21〜23時）かつ 2時間（長さは OK）かつ 期間外 → 2つ
    $errors = violationsOf(TimeSlot::on('2026-12-01', 21, 23));

    expect(array_keys($errors))->toBe(['start_hour', 'date']);
});

describe('bookableUntil()（予約できる最終日）', function () {
    it('1か月後の同日を返す。月末なら溢れずにその月の末日', function (string $today, string $expected) {
        expect(rules()->bookableUntil(CarbonImmutable::parse($today.' 15:00'))->toDateString())->toBe($expected);
    })->with([
        '10/6 → 11/6' => ['2026-10-06', '2026-11-06'],
        '1/31 → 2/28' => ['2027-01-31', '2027-02-28'],
        'うるう年 1/31 → 2/29' => ['2028-01-31', '2028-02-29'],
        '3/31 → 4/30' => ['2027-03-31', '2027-04-30'],
    ]);
});

describe('dateClosedReason()（日付だけで決まる受付外の理由）', function () {
    it('昨日は Past、今日と1か月後の同日は受付中、その翌日は OutOfRange', function (string $date, ?DayClosedReason $expected) {
        expect(rules()->dateClosedReason(CarbonImmutable::parse($date), now15()))->toBe($expected);
    })->with([
        '昨日' => ['2026-10-05', DayClosedReason::Past],
        '今日' => ['2026-10-06', null],
        '1か月後の同日' => ['2026-11-06', null],
        'その翌日' => ['2026-11-07', DayClosedReason::OutOfRange],
    ]);
});

describe('isPastSlot()（その枠が始まっているか）', function () {
    it('開始時刻が今以前なら true', function (int $hour, bool $expected) {
        expect(rules()->isPastSlot(CarbonImmutable::parse('2026-10-06'), $hour, now15()))->toBe($expected);
    })->with([
        '14時の枠' => [14, true],
        '15時の枠（ちょうど今）' => [15, true],
        '16時の枠' => [16, false],
    ]);
});
