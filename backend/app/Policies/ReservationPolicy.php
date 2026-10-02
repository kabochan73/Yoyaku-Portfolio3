<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Reservation;
use App\Models\User;

/**
 * 予約に対して「誰が何をしてよいか」（docs/04 の「認可」）。
 *
 * Laravel は名前（App\Models\Reservation → App\Policies\ReservationPolicy）から、このクラスを自動で見つける。
 * Controller で Gate::authorize('cancel', $reservation) と呼ぶと、ここの cancel() が使われ、
 * false なら 403 forbidden になる（ApiExceptionRenderer）。
 */
final class ReservationPolicy
{
    /**
     * 会員用のキャンセル（POST /api/reservations/{id}/cancel）: 自分の予約だけ（docs/01 の C1）。
     *
     * 管理者でも、このルートでは他人の予約をキャンセルできない。
     * ここでキャンセルすると理由が「会員によるキャンセル」になり、会員に届くメールの文面が変わってしまうため。
     * 管理者は /api/admin/reservations/{id}/cancel（手順7。理由は by_admin）を使う。
     *
     * キャンセルできる状態か（確定済み・開始前）は、ここではなく CancelReservation が調べる（409）。
     */
    public function cancel(User $user, Reservation $reservation): bool
    {
        return $reservation->user_id === $user->id;
    }
}
