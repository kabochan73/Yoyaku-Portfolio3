<?php

declare(strict_types=1);

use App\Enums\PriceType;
use App\Models\Price;
use App\Models\RegularHoliday;

/*
 * GET /api/facility（施設情報・予約のルール・料金・定休日）のテスト。
 */

/** 料金の2行を作る */
function seedPrices(int $weekday = 4000, int $weekend = 5000): void
{
    Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => $weekday]);
    Price::query()->create(['type' => PriceType::Weekend, 'amount_per_hour' => $weekend]);
}

it('ログインしていなくても、決まった形で返す', function () {
    seedPrices();
    RegularHoliday::query()->create(['day_of_week' => 1]);

    $this->getJson('/api/facility')
        ->assertOk()
        ->assertExactJson([
            'data' => [
                'name' => config('facility.name'),
                'phone' => config('facility.phone'),
                'address' => config('facility.address'),
                'email' => config('facility.email'),
                'rules' => [
                    'open_hour' => 10,
                    'close_hour' => 22,
                    'min_hours' => 2,
                    'max_hours' => 4,
                    'booking_window_months' => 1,
                ],
                'prices' => ['weekday' => 4000, 'weekend' => 5000],
                'regular_holidays' => [1],
            ],
        ]);
});

it('rules は config/facility.php の値をそのまま返す（D1）', function () {
    seedPrices();
    // 営業時間を変えたら、フロントに渡る値も変わる（フロントがルールを持たないことの確認）
    config([
        'facility.rules.open_hour' => 9,
        'facility.rules.close_hour' => 23,
        'facility.rules.min_hours' => 1,
        'facility.rules.max_hours' => 3,
        'facility.rules.booking_window_months' => 2,
    ]);

    $this->getJson('/api/facility')
        ->assertOk()
        ->assertJsonPath('data.rules', [
            'open_hour' => 9,
            'close_hour' => 23,
            'min_hours' => 1,
            'max_hours' => 3,
            'booking_window_months' => 2,
        ]);
});

it('料金と定休日は DB の値を返し、定休日は小さい順に並べる', function () {
    seedPrices(weekday: 4500, weekend: 6000);
    // わざと順番を崩して入れる
    RegularHoliday::query()->create(['day_of_week' => 4]);
    RegularHoliday::query()->create(['day_of_week' => 0]);
    RegularHoliday::query()->create(['day_of_week' => 1]);

    $this->getJson('/api/facility')
        ->assertOk()
        ->assertJsonPath('data.prices', ['weekday' => 4500, 'weekend' => 6000])
        ->assertJsonPath('data.regular_holidays', [0, 1, 4]);
});

it('定休日が無ければ空の配列を返す', function () {
    seedPrices();

    $response = $this->getJson('/api/facility')->assertOk();

    // null や {} ではなく [] であること（フロントは配列として扱う）
    expect($response->json('data.regular_holidays'))->toBe([]);
    expect($response->getContent())->toContain('"regular_holidays":[]');
});

it('料金の行が足りなければ 500 にする（0円で表示しない）', function () {
    Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => 4000]);

    $this->getJson('/api/facility')
        ->assertStatus(500)
        ->assertJson(['code' => 'server_error']);
});
