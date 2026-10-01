<?php

declare(strict_types=1);

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| 定期実行（scheduler コンテナの `php artisan schedule:work` が動かす）
|--------------------------------------------------------------------------
*/

// 古い予約を毎日削除する。対象は App\Models\Reservation::prunable()（予約日が3か月より前）。
// model:prune は app/Models の中から Prunable / MassPrunable を付けたモデルを探して実行する
Schedule::command('model:prune')->daily();
