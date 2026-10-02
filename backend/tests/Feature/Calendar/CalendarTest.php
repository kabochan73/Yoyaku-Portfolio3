<?php

declare(strict_types=1);

use App\Models\Holiday;
use App\Models\RegularHoliday;
use App\Models\Reservation;
use App\Models\User;
use App\Queries\CalendarFacts;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/*
 * GET /api/calendar（公開のカレンダー）のテスト。
 *
 * 今を 2026-10-06（火）15:00 に固定する。予約できる最終日は 2026-11-06。
 * 2026-10-05 は月曜。月曜を定休日にしておく。
 * 判定の細かい組み合わせは CalendarQueryTest で確かめているので、ここでは API としての形と振る舞いを見る。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00'));
    RegularHoliday::query()->create(['day_of_week' => 1]);
});

/** 1週間分（10/5〜10/11）を呼ぶ URL */
const WEEK_URL = '/api/calendar?from=2026-10-05&to=2026-10-11';

it('決まった形で返す（meta と、日ごとの closed_reason・slots）', function () {
    Reservation::factory()->on('2026-10-07', 12, 14)->create();
    Holiday::query()->create(['date' => '2026-10-08']);

    $response = $this->getJson('/api/calendar?from=2026-10-05&to=2026-10-08')->assertOk();

    expect($response->json('meta'))->toBe(['today' => '2026-10-06', 'bookable_until' => '2026-11-06']);

    // 受付外の日は slots が空
    expect($response->json('data.0'))->toBe(['date' => '2026-10-05', 'closed_reason' => 'past', 'slots' => []])
        ->and($response->json('data.3'))->toBe(['date' => '2026-10-08', 'closed_reason' => 'holiday', 'slots' => []]);

    // 今日: 15時までは過去、16時からは空き
    expect($response->json('data.1.date'))->toBe('2026-10-06')
        ->and($response->json('data.1.closed_reason'))->toBeNull()
        ->and($response->json('data.1.slots.5'))->toBe(['hour' => 15, 'status' => 'past'])
        ->and($response->json('data.1.slots.6'))->toBe(['hour' => 16, 'status' => 'available']);

    // 明日: 12〜14時が予約済み。時は数字（R1 は "10" のような文字列だった）
    expect($response->json('data.2.slots'))->toHaveCount(12)
        ->and($response->json('data.2.slots.2'))->toBe(['hour' => 12, 'status' => 'booked'])
        ->and($response->json('data.2.slots.4'))->toBe(['hour' => 14, 'status' => 'available']);
});

it('ログインしていない人・会員・管理者のどれが呼んでも同じ内容を返す', function () {
    Reservation::factory()->on('2026-10-07', 12, 14)->create();

    $guest = $this->getJson(WEEK_URL)->assertOk()->json();
    nextRequest();
    $member = $this->actingAs(User::factory()->create())->getJson(WEEK_URL)->assertOk()->json();
    nextRequest();
    $admin = $this->actingAs(User::factory()->admin()->create())->getJson(WEEK_URL)->assertOk()->json();

    expect($member)->toBe($guest)
        ->and($admin)->toBe($guest);
});

it('入力が正しくなければ 422', function (string $query, string $field) {
    $this->getJson("/api/calendar?{$query}")
        ->assertUnprocessable()
        ->assertJson(['code' => 'validation_failed'])
        ->assertJsonValidationErrors([$field]);
})->with([
    'from が無い' => ['to=2026-10-11', 'from'],
    'to が無い' => ['from=2026-10-05', 'to'],
    '日付の形が違う' => ['from=2026/10/05&to=2026-10-11', 'from'],
    'to が from より前' => ['from=2026-10-11&to=2026-10-05', 'to'],
    '15日分' => ['from=2026-10-05&to=2026-10-19', 'to'],
]);

it('期間が長すぎるときは、日数を入れたメッセージを返す', function () {
    $this->getJson('/api/calendar?from=2026-10-05&to=2026-10-19')
        ->assertJsonPath('errors.to.0', '期間は14日以内で指定してください。');
});

it('14日ちょうど・1日だけは取れる', function () {
    $this->getJson('/api/calendar?from=2026-10-05&to=2026-10-18')->assertOk()->assertJsonCount(14, 'data');
    $this->getJson('/api/calendar?from=2026-10-06&to=2026-10-06')->assertOk()->assertJsonCount(1, 'data');
});

it('ETag を付け、中身が同じなら 304、変わったら 200 で新しい中身を返す', function () {
    $first = $this->getJson(WEEK_URL)->assertOk();
    $etag = $first->headers->get('ETag');

    expect($etag)->not->toBeEmpty();

    // Cache-Control: 途中のキャッシュには保存させず、ブラウザは使う前に毎回確かめる
    expect($first->headers->get('Cache-Control'))->toContain('private')->toContain('no-cache');

    // 同じ ETag を送ると、本文なしの 304
    $this->getJson(WEEK_URL, ['If-None-Match' => $etag])
        ->assertStatus(304)
        ->assertContent('');

    // 予約が入り、その日のキャッシュが消えた（手順6で予約の commit 直後に消す）
    Reservation::factory()->on('2026-10-07', 12, 14)->create();
    app(CalendarFacts::class)->forgetDay(CarbonImmutable::parse('2026-10-07'));

    // 古い ETag を送っても、中身が変わったので 200 で新しい中身
    $changed = $this->getJson(WEEK_URL, ['If-None-Match' => $etag])->assertOk();

    expect($changed->headers->get('ETag'))->not->toBe($etag)
        ->and($changed->json('data.2.slots.2.status'))->toBe('booked');
});

it('2回目は予約・休業日・定休日のテーブルを読まない（Redis のキャッシュが効いている）', function () {
    $this->getJson(WEEK_URL)->assertOk();

    DB::flushQueryLog();
    DB::enableQueryLog();
    $this->getJson(WEEK_URL)->assertOk();
    DB::disableQueryLog();

    // ログインの確認などの問い合わせは数えず、カレンダーの事実を読む問い合わせだけを数える
    $calendarQueries = array_filter(
        DB::getQueryLog(),
        fn (array $log): bool => (bool) preg_match('/from "(reservations|holidays|regular_holidays)"/', $log['query']),
    );

    expect($calendarQueries)->toBe([]);
});

it('同じ IP から1分に61回呼んでも 429 にならない（300回/分まで通る）', function () {
    for ($i = 0; $i < 61; $i++) {
        $this->getJson(WEEK_URL)->assertOk();
    }
});
