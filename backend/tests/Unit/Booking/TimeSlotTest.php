<?php

declare(strict_types=1);

use App\Booking\TimeSlot;
use Carbon\CarbonImmutable;

/*
 * TimeSlot（予約の時間帯の値）のテスト。
 */

it('時間数を返す', function () {
    expect(TimeSlot::on('2026-10-06', 10, 12)->hours())->toBe(2)
        ->and(TimeSlot::on('2026-10-06', 18, 22)->hours())->toBe(4);
});

it('開始の日時を返す（日本時間）', function () {
    $startsAt = TimeSlot::on('2026-10-06', 10, 12)->startsAt();

    expect($startsAt->format('Y-m-d H:i'))->toBe('2026-10-06 10:00')
        ->and($startsAt->getTimezone()->getName())->toBe('Asia/Tokyo');
});

it('日付の時刻の部分は 0:00 にそろえる', function () {
    $slot = new TimeSlot(CarbonImmutable::parse('2026-10-06 15:30'), 10, 12);

    expect($slot->date->format('Y-m-d H:i:s'))->toBe('2026-10-06 00:00:00');
});

it('土日かを返す（祝日は平日扱い）', function (string $date, bool $expected) {
    expect(TimeSlot::on($date, 10, 12)->isWeekend())->toBe($expected);
})->with([
    '金曜' => ['2026-10-09', false],
    '土曜' => ['2026-10-10', true],
    '日曜' => ['2026-10-11', true],
    // 2026-10-12 はスポーツの日（祝日）だが、祝日の判定はしないので平日（docs/01）
    '祝日の月曜' => ['2026-10-12', false],
]);
