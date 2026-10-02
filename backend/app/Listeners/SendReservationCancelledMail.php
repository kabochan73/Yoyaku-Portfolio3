<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\ReservationCancelled;
use App\Mail\ReservationCancelledMail;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Support\Facades\Mail;

/**
 * 予約がキャンセルされたら、予約した会員にキャンセルのメールを送る（docs/01 の 8、docs/04 の「副作用」）。
 *
 * 文面はキャンセルの理由で変わる（会員・管理者・臨時休業日。ReservationCancelledMail）。
 * キュー・commit の後（ShouldQueueAfterCommit）・電話予約には送らない、は SendReservationConfirmedMail と同じ。
 * 臨時休業日の一括キャンセル（手順7）でロールバックしたら、1通も送られない（B7・B8）。
 */
final class SendReservationCancelledMail implements ShouldQueueAfterCommit
{
    public function handle(ReservationCancelled $event): void
    {
        $reservation = $event->reservation;
        $user = $reservation->user;

        if ($user === null) {
            return;
        }

        Mail::to($user)->send(new ReservationCancelledMail($reservation, $event->reason, $event->note));
    }
}
