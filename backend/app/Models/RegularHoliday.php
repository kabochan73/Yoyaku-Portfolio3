<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * 定休日の曜日。定休日の曜日1つにつき1行（docs/02 の regular_holidays）。
 * 全部の行が無ければ「定休日なし」。
 */
#[Fillable(['day_of_week'])]
final class RegularHoliday extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // 曜日。0 = 日曜、1 = 月曜 … 6 = 土曜（Carbon の dayOfWeek と同じ数え方）
            'day_of_week' => 'integer',
        ];
    }
}
