<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\ReservationStatus;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * テスト・デモ用の予約を作る（docs/06 の「テストデータは Factory の state で作る」）。
 *
 * 使い方:
 *   Reservation::factory()->create();                            // 会員の確定済み予約（会員も一緒に作る）
 *   Reservation::factory()->cancelled()->create();               // キャンセル済み
 *   Reservation::factory()->phone()->create();                   // 電話予約（会員なし）
 *   Reservation::factory()->on('2026-10-06', 10, 12)->create();  // 日付と時間帯を指定
 *   Reservation::factory()->for($user)->create();                // 会員を指定（Laravel 標準の for()）
 *
 * 状態は組み合わせられる: Reservation::factory()->phone()->on('2026-10-06', 18, 20)->cancelled()->create()
 *
 * @extends Factory<Reservation>
 */
final class ReservationFactory extends Factory
{
    /**
     * 既定の値: 明日の 10〜12時、会員の確定済み予約。
     *
     * 日付・時間帯を固定にしているのは、ランダムにすると別の予約と重なって排他制約（B2）に当たり、
     * テストがたまに落ちる（再現しない）ことがあるため。日付や時間帯がテストの結果に関わるときは、
     * on() で明示する。
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            // 予約した会員。User::factory() を渡すと、予約を作るときに会員も一緒に作られる
            'user_id' => User::factory(),
            'date' => today()->addDay()->toDateString(),
            'start_hour' => 10,
            'end_hour' => 12,
            'status' => ReservationStatus::Confirmed,
            // 予約者名は会員の名前。会員が作られた後に決まるので、関数で渡す（Laravel が後から呼ぶ）
            'booker_name' => fn (array $attributes): string => User::query()->findOrFail($attributes['user_id'])->name,
            // 金額は「4,000円 × 時間数」。料金の計算そのものは 3-5 の PriceCalculator で確かめる
            'price' => fn (array $attributes): int => 4000 * ($attributes['end_hour'] - $attributes['start_hour']),
            'cancelled_at' => null,
        ];
    }

    /**
     * キャンセル済みにする。
     * DB の CHECK 制約（キャンセル済みなら cancelled_at が必ず入る）を満たすよう、日時も一緒に入れる。
     */
    public function cancelled(): static
    {
        return $this->state(fn (): array => [
            'status' => ReservationStatus::Cancelled,
            'cancelled_at' => now(),
        ]);
    }

    /**
     * 電話予約（管理者の代理登録）にする。会員と紐づかず、予約者名は管理者が入力した名前。
     * 電話予約は「1人1日1件」の対象外（user_id が NULL なので部分ユニーク索引に当たらない）。
     */
    public function phone(): static
    {
        return $this->state(fn (): array => [
            'user_id' => null,
            'booker_name' => '電話 '.fake()->lastName(),
        ]);
    }

    /**
     * 日付と時間帯を指定する。
     *
     * @param  string  $date  利用日（'YYYY-MM-DD'）
     * @param  int  $startHour  開始の時（例: 10）
     * @param  int  $endHour  終了の時（例: 12。この時刻は含まない）
     */
    public function on(string $date, int $startHour, int $endHour): static
    {
        return $this->state(fn (): array => [
            'date' => $date,
            'start_hour' => $startHour,
            'end_hour' => $endHour,
        ]);
    }
}
