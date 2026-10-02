<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Reservation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 管理画面で予約を返すときの形（docs/03 の ReservationResource の「管理者向け」）。
 *
 * 会員向けの ReservationResource と同じ項目に、次の2つを足す:
 * - user_id  … 予約した会員の id。電話予約・退会した会員の予約は null
 * - is_phone … 電話予約（管理者の代理登録）か。管理カレンダーで予約者名の前に「☎」を付けるのに使う（docs/08 の 6.1）
 *
 * 会員向けの項目は ReservationResource に任せ、ここでは足すだけにする（項目を2か所で書かない）。
 *
 * @mixin Reservation
 */
final class AdminReservationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Reservation $reservation */
        $reservation = $this->resource;

        return [
            ...(new ReservationResource($reservation))->toArray($request),
            'user_id' => $reservation->user_id,
            // 会員と結びついていない予約 = 電話予約。
            // 退会した会員の予約も user_id が null になる（B9）が、どちらも「会員にメールが届かない予約」として同じに扱う
            'is_phone' => $reservation->user_id === null,
        ];
    }
}
