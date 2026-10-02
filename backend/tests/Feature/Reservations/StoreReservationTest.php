<?php

declare(strict_types=1);

use App\Enums\PriceType;
use App\Models\Holiday;
use App\Models\Price;
use App\Models\RegularHoliday;
use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;

/*
 * POST /api/reservations（予約する）のテスト。
 * ルールの細かい境界値は CreateReservationTest で確かめているので、ここでは API としての形と振る舞いを見る。
 *
 * 今を 2026-10-06（火）15:00 に固定する。月曜が定休日。料金は平日 4,000円/時。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Tokyo'));
    RegularHoliday::query()->create(['day_of_week' => 1]);
    Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => 4000]);
    Price::query()->create(['type' => PriceType::Weekend, 'amount_per_hour' => 5000]);
    $this->user = User::factory()->create(['name' => '山田太郎']);
});

it('予約できたら 201 で、予約を決まった形で返す', function () {
    $response = $this->actingAs($this->user)
        ->postJson('/api/reservations', ['date' => '2026-10-07', 'start_hour' => 12, 'end_hour' => 14])
        ->assertCreated();

    $reservation = Reservation::query()->sole();

    $response->assertExactJson([
        'data' => [
            'id' => $reservation->id,
            'date' => '2026-10-07',
            'start_hour' => 12,
            'end_hour' => 14,
            'hours' => 2,
            'price' => 8000,
            'status' => 'confirmed',
            'phase' => 'before_start',
            'is_cancellable' => true,
            'booker_name' => '山田太郎',
        ],
    ]);
    expect($reservation->user_id)->toBe($this->user->id);
});

it('入力の形が違えば 422', function (array $body, string $field) {
    $this->actingAs($this->user)
        ->postJson('/api/reservations', $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field]);
})->with([
    '日付が無い' => [['start_hour' => 12, 'end_hour' => 14], 'date'],
    '日付の形が違う' => [['date' => '2026/10/07', 'start_hour' => 12, 'end_hour' => 14], 'date'],
    '時が文字列（R1 の "12:00"）' => [['date' => '2026-10-07', 'start_hour' => '12:00', 'end_hour' => 14], 'start_hour'],
    '時が範囲外' => [['date' => '2026-10-07', 'start_hour' => 12, 'end_hour' => 25], 'end_hour'],
]);

it('ルール違反は 422 で、項目エラーとメッセージを返す', function () {
    // 長さ（1時間）の違反
    $this->actingAs($this->user)
        ->postJson('/api/reservations', ['date' => '2026-10-07', 'start_hour' => 12, 'end_hour' => 13])
        ->assertUnprocessable()
        ->assertJson(['code' => 'validation_failed'])
        ->assertJsonPath('errors.end_hour.0', '利用時間は2〜4時間で選んでください。');

    // 定休日（月曜）の違反。
    // 営業時間・長さなどの検査（BookingRules）を通った後に、定休日・休業日を調べるので、
    // 両方に違反しているときは、先の検査のエラーだけが返る
    $this->actingAs($this->user)
        ->postJson('/api/reservations', ['date' => '2026-10-12', 'start_hour' => 12, 'end_hour' => 14])
        ->assertUnprocessable()
        ->assertJsonPath('errors.date.0', '定休日のため予約できません。');
});

it('時間帯が埋まっていれば 409 slot_taken', function () {
    Reservation::factory()->on('2026-10-07', 13, 15)->create();

    $this->actingAs($this->user)
        ->postJson('/api/reservations', ['date' => '2026-10-07', 'start_hour' => 12, 'end_hour' => 14])
        ->assertConflict()
        ->assertExactJson([
            'message' => 'その時間帯は先に予約されました。別の時間をお選びください。',
            'code' => 'slot_taken',
        ]);
});

it('同じ日に自分の予約があれば 409 already_booked_that_day', function () {
    Reservation::factory()->for($this->user)->on('2026-10-07', 10, 12)->create();

    $this->actingAs($this->user)
        ->postJson('/api/reservations', ['date' => '2026-10-07', 'start_hour' => 18, 'end_hour' => 20])
        ->assertConflict()
        ->assertJson(['code' => 'already_booked_that_day']);
});

it('カレンダーで空きの枠は予約でき、受付外の日は 422（判定が予約時とカレンダーで一致する）', function () {
    Holiday::query()->create(['date' => '2026-10-08']);

    $calendar = $this->getJson('/api/calendar?from=2026-10-06&to=2026-10-12')->assertOk()->json('data');

    foreach ($calendar as $day) {
        // 毎回別の会員で予約する（1人1日1件に当たらないように）
        $member = User::factory()->create();
        $available = collect($day['slots'])->where('status', 'available')->pluck('hour')->values();

        if ($day['closed_reason'] !== null) {
            // 受付外の日（今日より前・定休日・休業日）
            $this->actingAs($member)
                ->postJson('/api/reservations', ['date' => $day['date'], 'start_hour' => 18, 'end_hour' => 20])
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['date']);
        } elseif ($available->count() >= 2) {
            // 空きの最初の2枠を予約する
            $start = $available[0];
            $this->actingAs($member)
                ->postJson('/api/reservations', ['date' => $day['date'], 'start_hour' => $start, 'end_hour' => $start + 2])
                ->assertCreated();
        }
        nextRequest();
    }
});

it('未ログインなら 401', function () {
    fromFrontend()
        ->postJson('/api/reservations', ['date' => '2026-10-07', 'start_hour' => 12, 'end_hour' => 14])
        ->assertUnauthorized();
});
