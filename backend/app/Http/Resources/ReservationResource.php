<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Reservation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 予約を API で返すときの形（docs/03 の ReservationResource）。
 *
 *   { "data": { "id": 1, "date": "2026-10-06", "start_hour": 12, "end_hour": 14, "hours": 2,
 *               "price": 8000, "status": "confirmed", "phase": "before_start",
 *               "is_cancellable": true, "booker_name": "山田太郎" } }
 *
 * - phase・is_cancellable は、返す時点の時刻（now()）から決める。フロントは端末の時計と比べない
 * - 時刻は「時（整数）」だけを返す。"12:00 〜 14:00" のような表示はフロント（formatHourRange）で作る
 * - user_id などは返さない（D4。管理者向けは手順7の AdminReservationResource で足す）
 *
 * 使う場所: GET /api/user/reservations（6-1）、予約の作成（6-2）、キャンセル（6-3）のレスポンス
 *
 * @mixin Reservation
 */
final class ReservationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $now = now()->toImmutable();

        return [
            'id' => $this->id,
            'date' => $this->date->toDateString(),
            'start_hour' => $this->start_hour,
            'end_hour' => $this->end_hour,
            'hours' => $this->timeSlot()->hours(),
            // 予約した時点の金額（後で料金が変わっても変わらない。docs/01 の R9）
            'price' => $this->price,
            'status' => $this->status->value,
            'phase' => $this->phase($now)->value,
            'is_cancellable' => $this->isCancellable($now),
            'booker_name' => $this->booker_name,
        ];
    }
}
