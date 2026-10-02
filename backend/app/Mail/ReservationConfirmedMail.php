<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * 予約完了のメール（会員が予約したとき。docs/01 の 8）。
 *
 * キューに積むのは送る側の Listener（SendReservationConfirmedMail）なので、ここには ShouldQueue を付けない
 * （両方に付けると、キューに2回積むことになる。docs/04 の「メール」）。
 */
final class ReservationConfirmedMail extends Mailable
{
    public function __construct(
        public readonly Reservation $reservation,
    ) {}

    public function envelope(): Envelope
    {
        // 施設名は config から（D14）。例: 【FUTSAL PARK】予約完了のお知らせ
        return new Envelope(
            subject: '【'.config('facility.name').'】予約完了のお知らせ',
        );
    }

    public function content(): Content
    {
        return new Content(view: 'mail.reservation-confirmed');
    }
}
