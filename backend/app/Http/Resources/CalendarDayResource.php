<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Queries\CalendarDay;
use App\Queries\CalendarSlot;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * カレンダーの1日を API で返すときの形（docs/03 の GET /calendar の data[]）。
 *
 *   { "date": "2026-10-06", "closed_reason": null,
 *     "slots": [ { "hour": 10, "status": "past" }, { "hour": 11, "status": "booked" }, … ] }
 *
 * - closed_reason … null（受付中）/ past / out_of_range / regular_holiday / holiday
 * - slots         … 受付中の日だけ。受付外の日は []（予約の有無も見せない）
 *
 * R1 は {"2026-10-06": {"closed": false, "slots": {"10": "available"}}} の形で、
 * 休みの理由が区別できず、時のキーが文字列の数字だった。
 *
 * @property CalendarDay $resource
 */
final class CalendarDayResource extends JsonResource
{
    /**
     * @return array{date: string, closed_reason: string|null, slots: list<array{hour: int, status: string}>}
     */
    public function toArray(Request $request): array
    {
        return [
            'date' => $this->resource->date->toDateString(),
            'closed_reason' => $this->resource->closedReason?->value,
            'slots' => array_map(
                fn (CalendarSlot $slot): array => ['hour' => $slot->hour, 'status' => $slot->status->value],
                $this->resource->slots,
            ),
        ];
    }
}
