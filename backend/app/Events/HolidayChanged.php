<?php

declare(strict_types=1);

namespace App\Events;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * 臨時休業日が登録された・解除された（docs/04 の「副作用」）。CloseDay・ReopenDay が出す。
 *
 * Listener: ForgetCalendarCache … その日のカレンダーのキャッシュを消す（休業日かどうかは日ごとの事実に入っている）
 * 予約のキャンセルのメールは、それぞれの ReservationCancelled から送られる（ここでは送らない）。
 */
final class HolidayChanged
{
    use Dispatchable;

    public function __construct(
        public readonly CarbonImmutable $date,
    ) {}
}
