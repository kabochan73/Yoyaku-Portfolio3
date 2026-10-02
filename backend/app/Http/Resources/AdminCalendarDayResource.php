<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Reservation;
use App\Queries\AdminCalendarDay;
use App\Queries\CalendarSlot;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 管理者用のカレンダーの1日を API で返すときの形（docs/03 の GET /admin/calendar の data[]）。
 *
 *   { "date": "2026-10-05", "closed_reason": "regular_holiday",
 *     "slots": [ { "hour": 18, "status": "booked", "reservation_id": 41 }, … ],
 *     "reservations": [ { "id": 41, …, "user_id": 5, "is_phone": false } ] }
 *
 * 枠には予約の id だけを付け、予約の中身は reservations に1回だけ入れる
 * （2〜4枠にまたがる予約を枠ごとに重ねない）。画面は reservation_id で reservations から引く。
 * R1 は枠の状態（/calendar）と予約者名（/admin/reservations）を別々に取り、画面で突き合わせていた。
 *
 * @property AdminCalendarDay $resource
 */
final class AdminCalendarDayResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'date' => $this->resource->date->toDateString(),
            'closed_reason' => $this->resource->closedReason?->value,
            'slots' => array_map(
                fn (CalendarSlot $slot): array => [
                    'hour' => $slot->hour,
                    'status' => $slot->status->value,
                    'reservation_id' => $slot->reservationId,
                ],
                $this->resource->slots,
            ),
            'reservations' => array_map(
                fn (Reservation $reservation): array => (new AdminReservationResource($reservation))->toArray($request),
                $this->resource->reservations,
            ),
        ];
    }
}
