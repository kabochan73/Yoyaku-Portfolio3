<?php

declare(strict_types=1);

namespace App\Queries;

use App\Enums\SlotStatus;

/**
 * カレンダーの1時間の枠（CalendarQuery が返す値）。
 * 例: hour 12 = 12:00〜13:00 の枠
 */
final readonly class CalendarSlot
{
    /**
     * @param  int|null  $reservationId  予約済みの枠に入っている予約の id。管理者用のカレンダーだけで使う（公開用では返さない）
     */
    public function __construct(
        public int $hour,
        public SlotStatus $status,
        public ?int $reservationId = null,
    ) {}
}
