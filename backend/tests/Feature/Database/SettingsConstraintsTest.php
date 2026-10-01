<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

/*
 * 施設の設定を入れる3テーブル（prices・regular_holidays・holidays）の DB 制約のテスト。
 * reservations と同じく、アプリを通さず DB に直接入れて確かめる（docs/06 の「Feature（DB 制約）」）。
 * expectViolation() は tests/Pest.php の共通の関数。
 */

describe('prices（料金）', function () {
    /**
     * 料金を1行、DB に直接入れる
     *
     * @param  array<string, mixed>  $overrides
     */
    $insertPrice = fn (array $overrides = []) => DB::table('prices')->insert(array_merge([
        'type' => 'weekday',
        'amount_per_hour' => 4000,
        'created_at' => now(),
        'updated_at' => now(),
    ], $overrides));

    it('平日・土日の2行が入る', function () use ($insertPrice) {
        $insertPrice(['type' => 'weekday']);
        $insertPrice(['type' => 'weekend', 'amount_per_hour' => 5000]);

        expect(DB::table('prices')->count())->toBe(2);
    });

    it('同じ種類の2行目は入らない', function () use ($insertPrice) {
        $insertPrice(['type' => 'weekday']);

        expectViolation(
            fn () => $insertPrice(['type' => 'weekday']),
            '23505',
            'prices_type_unique',
        );
    });

    it('平日・土日以外の種類は入らない', function () use ($insertPrice) {
        expectViolation(
            fn () => $insertPrice(['type' => 'holiday']),
            '23514',
            'prices_type_check',
        );
    });

    it('料金がマイナスなら入らない（0円は入る）', function () use ($insertPrice) {
        $insertPrice(['type' => 'weekday', 'amount_per_hour' => 0]);

        expectViolation(
            fn () => $insertPrice(['type' => 'weekend', 'amount_per_hour' => -1]),
            '23514',
            'prices_amount_per_hour_check',
        );
    });
});

describe('regular_holidays（定休日）', function () {
    $insertDay = fn (int $dayOfWeek) => DB::table('regular_holidays')->insert([
        'day_of_week' => $dayOfWeek,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    it('0（日曜）〜6（土曜）の曜日が入る', function () use ($insertDay) {
        foreach (range(0, 6) as $day) {
            $insertDay($day);
        }

        expect(DB::table('regular_holidays')->count())->toBe(7);
    });

    it('同じ曜日の2行目は入らない', function () use ($insertDay) {
        $insertDay(1);

        expectViolation(
            fn () => $insertDay(1),
            '23505',
            'regular_holidays_day_of_week_unique',
        );
    });

    it('0〜6の外の値は入らない', function (int $dayOfWeek) use ($insertDay) {
        expectViolation(
            fn () => $insertDay($dayOfWeek),
            '23514',
            'regular_holidays_day_of_week_check',
        );
    })->with([
        'マイナス' => [-1],
        '7（日曜を7と数える書き方）' => [7],
    ]);
});

describe('holidays（臨時休業日）', function () {
    $insertHoliday = fn (string $date, ?string $reason = null) => DB::table('holidays')->insert([
        'date' => $date,
        'reason' => $reason,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    it('理由は空でも入る', function () use ($insertHoliday) {
        $insertHoliday('2026-10-10');

        expect(DB::table('holidays')->value('reason'))->toBeNull();
    });

    it('同じ日の二重登録は入らない', function () use ($insertHoliday) {
        $insertHoliday('2026-10-10', '設備点検');

        expectViolation(
            fn () => $insertHoliday('2026-10-10', '別の理由'),
            '23505',
            'holidays_date_unique',
        );
    });
});
