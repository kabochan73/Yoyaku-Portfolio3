<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Booking\TimeSlot;
use Illuminate\Foundation\Http\FormRequest;

/**
 * 予約（POST /api/reservations）の入力チェック（docs/03）。
 *
 *   { "date": "2026-10-06", "start_hour": 12, "end_hour": 14 }
 *
 * ここで調べるのは「入力の形」だけ（日付の形か・時が 0〜24 の整数か）。
 * 営業時間・長さ・予約期間・定休日などのルールは CreateReservation（BookingRules・ClosedDays）が調べる。
 * ルールを1か所に置き、会員の予約と電話予約（手順7）で同じ検査を使うため。
 *
 * R1 は start_time: "12:00" の文字列で受け取っていた。R2 は時（整数）で受け取る（D6）。
 */
final class StoreReservationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'date' => ['required', 'date_format:Y-m-d'],
            // 0〜24 の範囲は DB の CHECK 制約と同じ。営業時間の中かは BookingRules が調べる
            'start_hour' => ['required', 'integer', 'between:0,24'],
            'end_hour' => ['required', 'integer', 'between:0,24'],
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
}
