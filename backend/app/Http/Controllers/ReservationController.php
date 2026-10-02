<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Resources\ReservationResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * 会員の予約に関する API（docs/03 の「会員」、docs/04 の「Controller の例」）。
 *
 * 予約の作成（6-2）とキャンセル（6-3）も、ここに足す。
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
}
