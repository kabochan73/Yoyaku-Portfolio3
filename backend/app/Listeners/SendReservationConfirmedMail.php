<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\ReservationCreated;
use App\Mail\ReservationConfirmedMail;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Support\Facades\Mail;

/**
 * 予約ができたら、予約した会員に完了メールを送る（docs/01 の 8、docs/04 の「副作用」）。
 *
 * - ShouldQueueAfterCommit: キュー（queue-worker）で送る。API の返事をメールの送信で待たせない。
 *   しかも、キューに積むのは commit の後。
 *   【B8】途中で失敗してロールバックしたら、メールは1通も送られない（R1 は commit の前に送っていた）
 *
 *   注意: キューに回す Listener には ShouldHandleEventsAfterCommit は効かない（キューに回さない Listener 用）。
 *   ShouldQueue + ShouldHandleEventsAfterCommit にすると、ロールバックしてもメールが送られてしまう。
 *   キューに回して、かつ commit の後にしたいときは ShouldQueueAfterCommit を使う（テストで確かめた。2026-10-02）
 * - 電話予約（会員と結びついていない予約）には送らない
 */
final class SendReservationConfirmedMail implements ShouldQueueAfterCommit
{
    public function handle(ReservationCreated $event): void
    {
        $reservation = $event->reservation;
        // 電話予約・退会した会員の予約は null（B9）
        $user = $reservation->user;

        if ($user === null) {
            return;
        }

        Mail::to($user)->send(new ReservationConfirmedMail($reservation));
    }
}
