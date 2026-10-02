<?php

declare(strict_types=1);

namespace App\Actions\Holidays;

use App\Events\HolidayChanged;
use App\Models\Holiday;
use Illuminate\Support\Facades\DB;

/**
 * 臨時休業日を解除する（docs/04 の「臨時休業日の登録」の最後）。
 *
 * 休業日を消すだけで、登録のときにキャンセルした予約は元に戻らない（管理画面の確認ダイアログでも伝える。docs/08 の 6.6）。
 * HolidayChanged を出し、その日のカレンダーのキャッシュを消す（すぐ予約を受け付けられるように）。
 */
final class ReopenDay
{
    public function handle(Holiday $holiday): void
    {
        DB::transaction(function () use ($holiday): void {
            $holiday->delete();

            HolidayChanged::dispatch($holiday->date);
        });
    }
}
