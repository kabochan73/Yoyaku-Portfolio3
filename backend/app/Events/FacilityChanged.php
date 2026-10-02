<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;

/**
 * 施設情報（料金・定休日）が変わった（docs/04 の「副作用（Event/Listener）」）。
 *
 * UpdatePrices・UpdateRegularHolidays が出す。Listener:
 * - RevalidateFrontendCache … トップの静的ページを作り直させる（B6）
 * - ForgetCalendarCache     … 定休日の一覧のキャッシュを消す
 */
final class FacilityChanged
{
    use Dispatchable;
}
