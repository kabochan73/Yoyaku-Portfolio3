<?php

declare(strict_types=1);

namespace App\Actions\Settings;

use App\Events\FacilityChanged;
use App\Models\RegularHoliday;
use Illuminate\Support\Facades\DB;

/**
 * 定休日の曜日を変える（docs/01 の 6.3、docs/03 の PUT /admin/regular-holidays）。
 *
 * 渡された曜日の一覧に置き換える（全部消してから入れ直す）。空なら定休日なし。
 * すでに入っている予約はキャンセルしない（docs/01 の 6.3）。その予約は管理カレンダーに
 * 「定休日に残った予約」として出て、必要なら管理者がキャンセルする（B11）。
 *
 * 変えた後は FacilityChanged を出す（トップの作り直し・定休日のキャッシュの削除。commit の後に動く）。
 */
final class UpdateRegularHolidays
{
    /**
     * @param  list<int>  $days  定休日の曜日（0 = 日曜 … 6 = 土曜）。重複なし（入力チェック済み）
     */
    public function handle(array $days): void
    {
        DB::transaction(function () use ($days): void {
            RegularHoliday::query()->delete();

            foreach ($days as $day) {
                RegularHoliday::query()->create(['day_of_week' => $day]);
            }

            FacilityChanged::dispatch();
        });
    }
}
