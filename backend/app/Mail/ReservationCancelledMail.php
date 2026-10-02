<?php

declare(strict_types=1);

namespace App\Mail;

use App\Enums\CancellationReason;
use App\Models\Reservation;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * 予約キャンセルのメール（docs/01 の 8）。理由で文面と件名を変える。
 *
 * | 理由                   | 文面                                     |
 * |------------------------|------------------------------------------|
 * | ByMember（会員）       | キャンセルを承りました                   |
 * | ByAdmin（管理者）      | 管理者によりキャンセルされました         |
 * | ByHoliday（臨時休業日）| 施設都合でキャンセル（休業の理由入り）   |
 *
 * キューに積むのは送る側の Listener（SendReservationCancelledMail）なので、ここには ShouldQueue を付けない。
 */
final class ReservationCancelledMail extends Mailable
{
    /**
     * @param  string|null  $note  休業の理由（ByHoliday のとき）
     */
    public function __construct(
        public readonly Reservation $reservation,
        public readonly CancellationReason $reason,
        public readonly ?string $note = null,
    ) {}

    public function envelope(): Envelope
    {
        $title = $this->reason === CancellationReason::ByHoliday
            ? '予約キャンセルのお知らせ（施設都合）'
            : '予約キャンセルのお知らせ';

        return new Envelope(
            subject: '【'.config('facility.name').'】'.$title,
        );
    }

    public function content(): Content
    {
        if ($this->reason === CancellationReason::ByHoliday) {
            return new Content(view: 'mail.reservation-cancelled-by-holiday');
        }

        return new Content(
            view: 'mail.reservation-cancelled',
            with: ['byAdmin' => $this->reason === CancellationReason::ByAdmin],
        );
    }
}
