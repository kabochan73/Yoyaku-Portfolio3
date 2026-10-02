<?php

declare(strict_types=1);

namespace App\Actions\Settings;

use App\Enums\PriceType;
use App\Events\FacilityChanged;
use App\Models\Price;
use Illuminate\Support\Facades\DB;

/**
 * 料金（平日・土日の1時間あたりの単価）を変える（docs/01 の 6.2、docs/03 の PUT /admin/prices）。
 *
 * 変えた後は FacilityChanged を出し、トップの静的ページを作り直させる（B6。Listener は commit の後に動く）。
 * すでに入っている予約の金額は変えない（予約した時点の金額を保存している。docs/01 の R9）。
 */
final class UpdatePrices
{
    /**
     * @param  int  $weekday  平日の単価（円）
     * @param  int  $weekend  土日の単価（円）
     */
    public function handle(int $weekday, int $weekend): void
    {
        DB::transaction(function () use ($weekday, $weekend): void {
            // 2行（平日・土日）は InitialDataSeeder で作ってある。無ければ作る（updateOrCreate）
            Price::query()->updateOrCreate(['type' => PriceType::Weekday], ['amount_per_hour' => $weekday]);
            Price::query()->updateOrCreate(['type' => PriceType::Weekend], ['amount_per_hour' => $weekend]);

            FacilityChanged::dispatch();
        });
    }
}
