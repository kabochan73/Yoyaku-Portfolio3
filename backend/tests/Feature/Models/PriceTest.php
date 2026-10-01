<?php

declare(strict_types=1);

use App\Enums\PriceType;
use App\Models\Price;

/*
 * Price::table()（DB の料金の2行から料金表を作る）のテスト。
 */

it('DB の平日・土日の行から料金表を作る', function () {
    Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => 4500]);
    Price::query()->create(['type' => PriceType::Weekend, 'amount_per_hour' => 6000]);

    $table = Price::table();

    expect($table->weekday)->toBe(4500)
        ->and($table->weekend)->toBe(6000);
});

it('行が1つ欠けていたら、0円で計算せずに例外にする', function () {
    // R1 では行が無いと「null × 時間 = 0円」の予約ができた
    Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => 4000]);

    expect(fn () => Price::table())
        ->toThrow(RuntimeException::class, '料金（weekend）が設定されていません');
});

it('行が1つも無くても例外にする', function () {
    expect(fn () => Price::table())->toThrow(RuntimeException::class);
});
