<?php

declare(strict_types=1);

namespace App\Actions\Reservations;

use App\Enums\CancellationReason;
use App\Events\ReservationCancelled;
use App\Exceptions\ConflictException;
use App\Models\Reservation;
use Illuminate\Support\Facades\DB;

/**
 * 予約をキャンセルする（docs/04 の「予約のキャンセル」、docs/01 の C1〜C4）。
 *
 * 会員のキャンセル（6-3）、管理者のキャンセル・臨時休業日による一括キャンセル（手順7）で、同じこの処理を使う。
 * 違いは理由（CancellationReason）だけで、メールの文面が変わる。
 * 「誰がキャンセルしてよいか」はここでは調べない（Controller の Policy・ルートの can:admin。docs/04 の「認可」）。
 */
final readonly class CancelReservation
{
    /**
     * @param  string|null  $note  メールに添える一言（臨時休業日の理由。手順7）
     *
     * @throws ConflictException キャンセル済み・開始済みの予約（409 reservation_not_cancellable）
     */
    public function handle(Reservation $reservation, CancellationReason $reason, ?string $note = null): Reservation
    {
        return DB::transaction(function () use ($reservation, $reason, $note): Reservation {
            // 行をロックして読み直す（SELECT ... FOR UPDATE）。
            // 会員と管理者が同時にキャンセルしても、後の人はロックが外れるまで待ち、
            // 読み直した時点では「キャンセル済み」なので 409 になる。メールが2通にならない
            $reservation = Reservation::query()->lockForUpdate()->findOrFail($reservation->id);

            $now = now()->toImmutable();

            // 【B4】キャンセルできるのは、確定済み かつ 開始前だけ（C2）。
            // R1 はキャンセル済み・終わった予約でも状態を上書きし、メールも送っていた
            if (! $reservation->isCancellable($now)) {
                throw ConflictException::reservationNotCancellable();
            }

            $reservation->cancel($now);

            // Listener（メール・キャッシュの削除）は commit の後に動く（6-4）
            ReservationCancelled::dispatch($reservation, $reason, $note);

            return $reservation;
        });
    }
}
