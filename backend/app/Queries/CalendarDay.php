<?php

declare(strict_types=1);

namespace App\Queries;

use App\Enums\DayClosedReason;
use Carbon\CarbonImmutable;

/**
 * カレンダーの1日（CalendarQuery が返す値）。JSON にするのは 5-3 の Resource。
 *
 * 配列ではなく小さなクラスにして、項目の名前と型を決めておく（docs/04 の「カレンダーの組み立て」）。
 */
final readonly class CalendarDay
{
    /**
     * @param  DayClosedReason|null  $closedReason  受付外の理由。受付中なら null
     * @param  list<CalendarSlot>  $slots  営業時間の1時間ごとの枠（時の順）。受付外の日は空
     */
    public function __construct(
        public CarbonImmutable $date,
        public ?DayClosedReason $closedReason,
        public array $slots,
    ) {}
}
