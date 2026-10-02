<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * カレンダーの1時間の枠の状態（docs/03 のカレンダーの slots[].status）。
 *
 * 公開のカレンダー（/calendar）では、受付中の日の枠だけに付く。受付外の日は枠そのものを返さない（slots: []）。
 * 管理者用のカレンダー（/admin/calendar）では、受付外の日も全部の枠を返し、予約が無い枠を Closed にする（B11）。
 * CalendarQuery が、予約済み → （受付外）→ 過去 → 空き の順に判定する（docs/04 の「カレンダーの組み立て」）。
 */
enum SlotStatus: string
{
    /** 空いていて、予約できる */
    case Available = 'available';

    /** 確定済みの予約が入っている */
    case Booked = 'booked';

    /** 今日の、もう始まった枠（B10。開始時刻ちょうども含む） */
    case Past = 'past';

    /** 受付外の日（定休日・休業日・過去・期間外）の、予約が無い枠。管理者用のカレンダーだけで使う（B11） */
    case Closed = 'closed';
}
