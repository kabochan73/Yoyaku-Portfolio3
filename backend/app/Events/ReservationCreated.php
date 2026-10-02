<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Reservation;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * 予約ができた（docs/04 の「副作用（Event/Listener）」。D2）。
 *
 * 予約を作る処理（CreateReservation）は、このイベントを出すだけにする。
 * 予約の後に起きること（完了メール・カレンダーのキャッシュの削除）は、6-4 の Listener に書き、
 * 何が起きるかを Listener の一覧で追えるようにする。
 * R1 は予約の Controller に、キャッシュの削除・メール送信・WebSocket の通知を直接書いていた。
 *
 * SerializesModels: キューで動く Listener（メール）に渡すとき、予約そのものではなく id だけを保存し、
 * 動くときに DB から読み直す。
 */
final class ReservationCreated
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly Reservation $reservation,
    ) {}
}
