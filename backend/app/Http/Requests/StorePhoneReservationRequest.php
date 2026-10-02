<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Booking\TimeSlot;
use Illuminate\Foundation\Http\FormRequest;

/**
 * 電話予約（POST /api/admin/reservations）の入力チェック（docs/03）。
 *
 *   { "date": "2026-10-06", "start_hour": 12, "end_hour": 14, "booker_name": "電話 佐藤" }
 *
 * 日付・時間の形は会員の予約（StoreReservationRequest）と同じ。予約者名を足す。
 * 営業時間などのルールは CreateReservation が調べる（会員の予約と同じ検査）。
 */
final class StorePhoneReservationRequest extends FormRequest
{
    public function authorize(): bool
    {
        // 管理者かどうかは、ルートの can:admin が調べている
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'date' => ['required', 'date_format:Y-m-d'],
            'start_hour' => ['required', 'integer', 'between:0,24'],
            'end_hour' => ['required', 'integer', 'between:0,24'],
            // reservations.booker_name は varchar(255)
            'booker_name' => ['required', 'string', 'max:255'],
        ];
    }

    /** 入力から時間帯を作る（入力チェックを通った後に呼ぶ） */
    public function timeSlot(): TimeSlot
    {
        return TimeSlot::on(
            $this->string('date')->toString(),
            $this->integer('start_hour'),
            $this->integer('end_hour'),
        );
    }

    /** 予約者名（前後の空白は Laravel が自動で落としている） */
    public function bookerName(): string
    {
        return $this->string('booker_name')->toString();
    }
}
