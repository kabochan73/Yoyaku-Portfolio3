<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Holiday;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 臨時休業日を API で返すときの形（docs/03 の HolidayResource）。
 *
 *   { "data": { "id": 3, "date": "2026-10-10", "reason": "設備点検" } }
 *
 * @mixin Holiday
 */
final class HolidayResource extends JsonResource
{
    /**
     * @return array{id: int, date: string, reason: string|null}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'date' => $this->date->toDateString(),
            'reason' => $this->reason,
        ];
    }
}
