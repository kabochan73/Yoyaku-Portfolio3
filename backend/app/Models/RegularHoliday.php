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

    /**
     * 定休日の曜日の一覧（小さい順）。定休日が無ければ空の配列。
     * 例: 月曜と木曜が定休日なら [1, 4]
     *
     * @return list<int>
     */
    public static function days(): array
    {
        /** @var list<int> */
        return self::query()->orderBy('day_of_week')->pluck('day_of_week')->all();
    }
}
