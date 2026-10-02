<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Actions\Reservations\CancelReservation;
use App\Actions\Reservations\CreateReservation;
use App\Enums\CancellationReason;
use App\Http\Requests\StoreReservationRequest;
use App\Http\Resources\ReservationResource;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

/**
 * 会員の予約に関する API（docs/03 の「会員」、docs/04 の「Controller の例」）。
 *
 * Controller は入力を受け取って Action を呼び、Resource で返すだけにする（ルールは Action と BookingRules に置く）。
 */
final class ReservationController extends Controller
{
    /**
     * GET /api/user/reservations — 自分の今日以降の確定済みの予約（日付・開始時刻の順）。
     *
     * 今日の予約は、すでに始まっていても含める（マイページで「ご利用中 / ご利用済み」と出す。docs/08 の 5.2）。
     * 未ログインのときは、ルートの auth:sanctum が 401 を返す（ここまで来ない）。
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        return ReservationResource::collection($user->reservations()->upcoming()->get());
    }

    /**
     * POST /api/reservations — 予約する。
     *
     * - 成功: 201 + ReservationResource
     * - ルール違反（営業時間外・2時間未満・定休日・予約期間外 など）: 422（項目エラー）
     * - 時間帯が埋まっていた・同じ日に予約がある: 409 slot_taken / already_booked_that_day
     *
     * 入力の形は StoreReservationRequest、ルールの検査と作成は CreateReservation が行う。
     */
    public function store(StoreReservationRequest $request, CreateReservation $createReservation): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $reservation = $createReservation->forMember($user, $request->timeSlot());

        return ReservationResource::make($reservation)->response()->setStatusCode(201);
    }

    /**
     * POST /api/reservations/{reservation}/cancel — 自分の予約をキャンセルする。
     *
     * - 成功: 200 + ReservationResource（status: "cancelled"）
     * - 他人の予約: 403（ReservationPolicy。管理者でもこのルートでは 403）
     * - キャンセル済み・開始済み: 409 reservation_not_cancellable（CancelReservation）
     * - 無い予約: 404（{reservation} を Laravel が id で探し、無ければ 404 にする）
     *
     * R1 は DELETE /reservations/{id} だった。行を消すのではなく状態を変える操作なので、POST .../cancel にした（docs/03）。
     */
    public function cancel(Reservation $reservation, CancelReservation $cancelReservation): ReservationResource
    {
        Gate::authorize('cancel', $reservation);

        return ReservationResource::make(
            $cancelReservation->handle($reservation, CancellationReason::ByMember),
        );
    }
}
