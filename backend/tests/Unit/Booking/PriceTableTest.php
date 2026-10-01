<?php

declare(strict_types=1);

use App\Booking\PriceTable;
use App\Booking\TimeSlot;
use App\Enums\PriceType;

/*
 * PriceTable（料金表）のテスト。平日 4,000円・土日 5,000円（R2 の初期値）で確かめる。
 */

function priceTable(): PriceTable
{
    return new PriceTable(weekday: 4000, weekend: 5000);
}

it('その日の単価 × 時間数を返す', function (string $date, int $start, int $end, int $expected) {
    expect(priceTable()->priceFor(TimeSlot::on($date, $start, $end)))->toBe($expected);
})->with([
    '平日（金曜）2時間' => ['2026-10-09', 10, 12, 8000],
    '平日（金曜）4時間' => ['2026-10-09', 18, 22, 16000],
    '土曜 2時間' => ['2026-10-10', 10, 12, 10000],
    '日曜 3時間' => ['2026-10-11', 19, 22, 15000],
    // 2026-10-12 はスポーツの日（祝日）。祝日は判定しないので平日料金（docs/01）
    '祝日の月曜 2時間' => ['2026-10-12', 10, 12, 8000],
]);

it('単価の種類は、土日なら Weekend・それ以外は Weekday', function () {
    expect(priceTable()->typeFor(TimeSlot::on('2026-10-09', 10, 12)))->toBe(PriceType::Weekday)
        ->and(priceTable()->typeFor(TimeSlot::on('2026-10-10', 10, 12)))->toBe(PriceType::Weekend);
});

it('種類ごとの単価を返す', function () {
    expect(priceTable()->unitPrice(PriceType::Weekday))->toBe(4000)
        ->and(priceTable()->unitPrice(PriceType::Weekend))->toBe(5000);
});
