<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * カレンダーの1時間の枠の状態（docs/03 のカレンダーの slots[].status）。
 *
 * 受付中の日の枠だけに付く。受付外の日（定休日など）は枠そのものを返さない（slots: []）。
 * CalendarQuery が、予約済み → 過去 → 空き の順に判定する（docs/04 の「カレンダーの組み立て」）。
 */
enum SlotStatus: string
{
    /** 空いていて、予約できる */
    case Available = 'available';

    /** 確定済みの予約が入っている */
    case Booked = 'booked';

    /** 今日の、もう始まった枠（B10。開始時刻ちょうども含む） */
    case Past = 'past';
}
