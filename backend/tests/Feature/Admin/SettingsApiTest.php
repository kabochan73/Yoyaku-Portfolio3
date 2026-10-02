<?php

declare(strict_types=1);

use App\Enums\PriceType;
use App\Models\Price;
use App\Models\RegularHoliday;
use App\Models\User;

/*
 * PUT /api/admin/prices・PUT /api/admin/regular-holidays のテスト（docs/03）。
 */

beforeEach(function () {
    Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => 4000]);
    Price::query()->create(['type' => PriceType::Weekend, 'amount_per_hour' => 5000]);
    RegularHoliday::query()->create(['day_of_week' => 1]);
    $this->admin = User::factory()->admin()->create();
});

it('料金を変え、更新後の施設情報を /facility と同じ形で返す', function () {
    $response = $this->actingAs($this->admin)
        ->putJson('/api/admin/prices', ['weekday' => 4500, 'weekend' => 6000])
        ->assertOk()
        ->assertJsonPath('data.prices', ['weekday' => 4500, 'weekend' => 6000]);

    nextRequest();
    expect($response->json())->toBe($this->getJson('/api/facility')->json());
});

it('料金の入力が正しくなければ 422（空欄を 0円にしない。B16）', function (array $body, string $field) {
    $this->actingAs($this->admin)
        ->putJson('/api/admin/prices', $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field]);

    expect(Price::table()->weekday)->toBe(4000);
})->with([
    '平日が無い' => [['weekend' => 5000], 'weekday'],
    '空欄' => [['weekday' => '', 'weekend' => 5000], 'weekday'],
    '負の数' => [['weekday' => -1, 'weekend' => 5000], 'weekday'],
    '小数' => [['weekday' => 4000, 'weekend' => 1.5], 'weekend'],
]);

it('0円は許す', function () {
    $this->actingAs($this->admin)
        ->putJson('/api/admin/prices', ['weekday' => 0, 'weekend' => 0])
        ->assertOk();
});

it('定休日を変え、更新後の施設情報を返す', function () {
    $this->actingAs($this->admin)
        ->putJson('/api/admin/regular-holidays', ['days' => [3, 0]])
        ->assertOk()
        ->assertJsonPath('data.regular_holidays', [0, 3]);
});

it('定休日なし（空の配列）にできる', function () {
    $this->actingAs($this->admin)
        ->putJson('/api/admin/regular-holidays', ['days' => []])
        ->assertOk()
        ->assertJsonPath('data.regular_holidays', []);
});

it('定休日の入力が正しくなければ 422', function (array $body, string $field) {
    $this->actingAs($this->admin)
        ->putJson('/api/admin/regular-holidays', $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors([$field]);
})->with([
    'days が無い' => [[], 'days'],
    '7（範囲外）' => [['days' => [7]], 'days.0'],
    '重複' => [['days' => [1, 1]], 'days.0'],
    '文字' => [['days' => ['mon']], 'days.0'],
]);

it('会員は 403', function () {
    $member = User::factory()->create();

    $this->actingAs($member)->putJson('/api/admin/prices', ['weekday' => 1, 'weekend' => 1])->assertForbidden();
    $this->actingAs($member)->putJson('/api/admin/regular-holidays', ['days' => []])->assertForbidden();
});
