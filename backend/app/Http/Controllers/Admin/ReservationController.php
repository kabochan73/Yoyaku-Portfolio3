<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Actions\Reservations\CancelReservation;
use App\Actions\Reservations\CreateReservation;
use App\Enums\CancellationReason;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePhoneReservationRequest;
use App\Http\Resources\AdminReservationResource;
use App\Models\Reservation;
use Illuminate\Http\JsonResponse;

/**
 * 管理者の予約の操作（docs/03 の「管理者」）。管理者だけが呼べる（routes/api.php の can:admin）。
 *
 * 予約の作成・キャンセルの処理そのものは、会員と同じ Action（CreateReservation・CancelReservation）を使う。
 */
final class ReservationController extends Controller
{
    /**
     * POST /api/admin/reservations — 電話予約を登録する。
     *
     * - 成功: 201 + AdminReservationResource（is_phone: true）
     * - ルール違反: 422 / 時間帯が埋まっていた: 409 slot_taken（会員の予約と同じ）
     */
    public function store(StorePhoneReservationRequest $request, CreateReservation $createReservation): JsonResponse
    {
        $reservation = $createReservation->forPhone($request->bookerName(), $request->timeSlot());

        return AdminReservationResource::make($reservation)->response()->setStatusCode(201);
    }

    /**
     * POST /api/admin/reservations/{reservation}/cancel — 予約をキャンセルする（誰の予約でも・電話予約でも）。
     *
     * 理由は「管理者によるキャンセル」（ByAdmin）。会員の予約なら、その文面のメールが届く（6-4）。
     * 会員用のルート（/api/reservations/{id}/cancel）を管理者に開けないのは、理由（メールの文面）が変わるため（docs/04 の「認可」）。
     *
     * - 成功: 200 + AdminReservationResource（status: "cancelled"）
     * - キャンセル済み・開始済み: 409 reservation_not_cancellable（会員と同じ）
     */
    public function cancel(Reservation $reservation, CancelReservation $cancelReservation): AdminReservationResource
    {
        return AdminReservationResource::make(
            $cancelReservation->handle($reservation, CancellationReason::ByAdmin),
        );
    }
}
