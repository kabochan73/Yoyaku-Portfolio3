<?php

declare(strict_types=1);

use App\Models\Holiday;
use App\Models\RegularHoliday;
use App\Models\Reservation;
use App\Queries\CalendarFacts;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RedisStore;
use Illuminate\Support\Facades\Cache;

/*
 * CalendarFacts（カレンダーの「事実」を Redis に日ごとにキャッシュして読む）のテスト。
 * キャッシュはテスト用の Redis（phpunit.xml）を使い、各テストの前に空にしている（tests/Pest.php）。
 */

it('期間の日ごとに、確定済みの予約と臨時休業日を返す', function () {
    $booked = Reservation::factory()->on('2026-10-06', 12, 14)->create(['booker_name' => '山田太郎', 'price' => 8000]);
    Holiday::query()->create(['date' => '2026-10-07', 'reason' => '設備点検']);

    $facts = app(CalendarFacts::class)->days(CarbonImmutable::parse('2026-10-05'), CarbonImmutable::parse('2026-10-07'));

    // 予約も休業日も無い日を含め、期間の全部の日がある（日付の順）
    expect(array_keys($facts))->toBe(['2026-10-05', '2026-10-06', '2026-10-07']);

    expect($facts['2026-10-05']->reservations)->toBe([])
        ->and($facts['2026-10-05']->isHoliday)->toBeFalse();

    expect($facts['2026-10-06']->reservations)->toBe([[
        'id' => $booked->id,
        'start_hour' => 12,
        'end_hour' => 14,
        'booker_name' => '山田太郎',
        'user_id' => $booked->user_id,
        'price' => 8000,
    ]]);

    expect($facts['2026-10-07']->isHoliday)->toBeTrue()
        ->and($facts['2026-10-07']->holidayReason)->toBe('設備点検');
});

it('キャンセル済みの予約は入れない', function () {
    Reservation::factory()->on('2026-10-06', 12, 14)->cancelled()->create();

    $facts = app(CalendarFacts::class)->days(CarbonImmutable::parse('2026-10-06'), CarbonImmutable::parse('2026-10-06'));

    expect($facts['2026-10-06']->reservations)->toBe([]);
});

it('isBooked は、予約の開始から終了の前の時までを予約済みとみなす', function () {
    Reservation::factory()->on('2026-10-06', 12, 14)->create();

    $facts = app(CalendarFacts::class)->days(CarbonImmutable::parse('2026-10-06'), CarbonImmutable::parse('2026-10-06'));

    expect($facts['2026-10-06']->isBooked(11))->toBeFalse()
        ->and($facts['2026-10-06']->isBooked(12))->toBeTrue()
        ->and($facts['2026-10-06']->isBooked(13))->toBeTrue()
        // 14時は終了の時刻なので空いている
        ->and($facts['2026-10-06']->isBooked(14))->toBeFalse();
});

it('DB への問い合わせは、日数に関係なく予約と臨時休業日の2回だけ', function () {
    $queries = countQueries(fn () => app(CalendarFacts::class)->days(CarbonImmutable::parse('2026-10-05'), CarbonImmutable::parse('2026-10-18')));

    expect($queries)->toBe(2);
});

it('2回目はキャッシュから読み、DB に問い合わせない', function () {
    $facts = app(CalendarFacts::class);
    $first = $facts->days(CarbonImmutable::parse('2026-10-05'), CarbonImmutable::parse('2026-10-11'));

    // キャッシュがあるので、この後に DB を変えても、読み出しの結果は変わらない（DB を見ていない）
    Reservation::factory()->on('2026-10-06', 12, 14)->create();

    $queries = countQueries(function () use ($facts, &$second) {
        $second = $facts->days(CarbonImmutable::parse('2026-10-05'), CarbonImmutable::parse('2026-10-11'));
    });

    expect($queries)->toBe(0)
        ->and($second)->toEqual($first);
});

it('キャッシュに無い日だけを DB から読む', function () {
    $facts = app(CalendarFacts::class);
    // 10/5〜10/11 をキャッシュに入れておく
    $facts->days(CarbonImmutable::parse('2026-10-05'), CarbonImmutable::parse('2026-10-11'));

    // 10/12 だけに予約を入れる（キャッシュに無い日）
    Reservation::factory()->on('2026-10-12', 10, 12)->create();
    // 10/6 にも予約を入れる（キャッシュにある日。読み出しには出ないはず）
    Reservation::factory()->on('2026-10-06', 10, 12)->create();

    $days = $facts->days(CarbonImmutable::parse('2026-10-06'), CarbonImmutable::parse('2026-10-12'));

    expect($days['2026-10-12']->reservations)->toHaveCount(1)
        ->and($days['2026-10-06']->reservations)->toBe([]);
});

it('forgetDay で消した日だけ、次に読むと DB から取り直す', function () {
    $facts = app(CalendarFacts::class);
    $facts->days(CarbonImmutable::parse('2026-10-06'), CarbonImmutable::parse('2026-10-07'));

    Reservation::factory()->on('2026-10-06', 10, 12)->create();
    Reservation::factory()->on('2026-10-07', 10, 12)->create();

    // 予約を入れた後に、その日のキャッシュを消す（手順6で予約の commit 直後にすること）
    $facts->forgetDay(CarbonImmutable::parse('2026-10-06'));

    $days = $facts->days(CarbonImmutable::parse('2026-10-06'), CarbonImmutable::parse('2026-10-07'));

    expect($days['2026-10-06']->reservations)->toHaveCount(1)
        // 10/7 は消していないので、古いまま（期限の60秒で直る）
        ->and($days['2026-10-07']->reservations)->toBe([]);
});

it('定休日の一覧もキャッシュし、forgetRegularHolidays で消せる', function () {
    $facts = app(CalendarFacts::class);
    RegularHoliday::query()->create(['day_of_week' => 1]);

    expect($facts->regularHolidays())->toBe([1]);

    RegularHoliday::query()->create(['day_of_week' => 4]);

    // キャッシュがあるので、まだ古い
    expect($facts->regularHolidays())->toBe([1]);

    $facts->forgetRegularHolidays();

    expect($facts->regularHolidays())->toBe([1, 4]);
});

it('キャッシュの期限は config の calendar_cache_ttl（60秒）', function () {
    app(CalendarFacts::class)->days(CarbonImmutable::parse('2026-10-06'), CarbonImmutable::parse('2026-10-06'));
    app(CalendarFacts::class)->regularHolidays();

    // Redis に残っている秒数を直接見る
    /** @var RedisStore $store */
    $store = Cache::getStore();
    $ttl = fn (string $key): int => $store->connection()->ttl($store->getPrefix().$key);

    expect($ttl('calendar:day:2026-10-06'))->toBeGreaterThan(55)->toBeLessThanOrEqual(60)
        ->and($ttl('calendar:regular_holidays'))->toBeGreaterThan(55)->toBeLessThanOrEqual(60);
});

it('$from が $to より後なら、空を返す', function () {
    expect(app(CalendarFacts::class)->days(CarbonImmutable::parse('2026-10-07'), CarbonImmutable::parse('2026-10-06')))->toBe([]);
});
