<?php

declare(strict_types=1);

use App\Models\Holiday;
use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;

/*
 * /api/admin/holidays（臨時休業日の一覧・登録・解除）のテスト。
 * 登録の細かい流れは CloseDayTest で確かめているので、ここでは API としての形と権限を見る。
 * 今を 2026-10-06（火）14:00 に固定する。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 14:00', 'Asia/Tokyo'));
    $this->admin = User::factory()->admin()->create();
});

it('一覧は今日以降の休業日を日付順に返す', function () {
    Holiday::query()->create(['date' => '2026-10-20', 'reason' => '設備点検']);
    Holiday::query()->create(['date' => '2026-10-06']);
    Holiday::query()->create(['date' => '2026-10-05', 'reason' => '昨日']);

    $this->actingAs($this->admin)
        ->getJson('/api/admin/holidays')
        ->assertOk()
        ->assertJsonPath('data.*.date', ['2026-10-06', '2026-10-20'])
        ->assertJsonPath('data.1.reason', '設備点検');
});

it('予約が無い日は、そのまま登録して 201 を返す', function () {
    $this->actingAs($this->admin)
        ->postJson('/api/admin/holidays', ['date' => '2026-10-08', 'reason' => '設備点検'])
        ->assertCreated()
        ->assertJsonPath('data.date', '2026-10-08')
        ->assertJsonPath('data.reason', '設備点検');
});

it('予約がある日は 409 と件数を返し、確認して送り直すと 201', function () {
    Reservation::factory()->on('2026-10-08', 10, 12)->create();

    $this->actingAs($this->admin)
        ->postJson('/api/admin/holidays', ['date' => '2026-10-08'])
        ->assertConflict()
        ->assertExactJson([
            'message' => 'この日には1件の予約があります。すべてキャンセルして休業日にしますか？',
            'code' => 'holiday_has_reservations',
            'reservation_count' => 1,
        ]);

    $this->actingAs($this->admin)
        ->postJson('/api/admin/holidays', ['date' => '2026-10-08', 'cancel_reservations' => true])
        ->assertCreated()
        ->assertJsonPath('data.reason', null);
});

it('同じ日をもう一度登録すると 409 holiday_already_exists', function () {
    Holiday::query()->create(['date' => '2026-10-08']);

    $this->actingAs($this->admin)
        ->postJson('/api/admin/holidays', ['date' => '2026-10-08'])
        ->assertConflict()
        ->assertJson(['code' => 'holiday_already_exists']);
});

it('入力が正しくなければ 422（過去の日・日付の形・長すぎる理由）', function (array $body, string $field) {
    $this->actingAs($this->admin)
        ->postJson('/api/admin/holidays', $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field]);
})->with([
    '昨日' => [['date' => '2026-10-05'], 'date'],
    '日付が無い' => [[], 'date'],
    '日付の形が違う' => [['date' => '2026/10/08'], 'date'],
    '理由が256文字' => [['date' => '2026-10-08', 'reason' => str_repeat('あ', 256)], 'reason'],
]);

it('今日は登録できる', function () {
    $this->actingAs($this->admin)
        ->postJson('/api/admin/holidays', ['date' => '2026-10-06'])
        ->assertCreated();
});

it('解除すると 204（本文なし）', function () {
    $holiday = Holiday::query()->create(['date' => '2026-10-08']);

    $this->actingAs($this->admin)
        ->deleteJson("/api/admin/holidays/{$holiday->id}")
        ->assertNoContent();

    expect(Holiday::query()->exists())->toBeFalse();
});

it('会員は 403', function () {
    $member = User::factory()->create();
    $holiday = Holiday::query()->create(['date' => '2026-10-08']);

    $this->actingAs($member)->getJson('/api/admin/holidays')->assertForbidden();
    $this->actingAs($member)->postJson('/api/admin/holidays', ['date' => '2026-10-09'])->assertForbidden();
    $this->actingAs($member)->deleteJson("/api/admin/holidays/{$holiday->id}")->assertForbidden();
});
