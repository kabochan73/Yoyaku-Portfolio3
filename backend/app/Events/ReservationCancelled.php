<?php

declare(strict_types=1);

namespace App\Events;

use App\Enums\CancellationReason;
use App\Models\Reservation;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * 予約がキャンセルされた（docs/04 の「副作用（Event/Listener）」。D2）。
 *
 * キャンセルの処理（CancelReservation）は、このイベントを出すだけにする。
 * キャンセルの後に起きること（キャンセルのメール・カレンダーのキャッシュの削除）は 6-4 の Listener に書く。
 */
final class ReservationCancelled
{
    use Dispatchable;
    use SerializesModels;

    /**
     * @param  CancellationReason  $reason  理由。メールの文面が変わる（会員・管理者・臨時休業日）
     * @param  string|null  $note  メールに添える一言。臨時休業日の理由（例: 設備点検）を入れる（手順7）
     */
    public function __construct(
        public readonly Reservation $reservation,
        public readonly CancellationReason $reason,
        public readonly ?string $note = null,
    ) {}
}
