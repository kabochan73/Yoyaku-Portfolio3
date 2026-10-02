<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

/**
 * 臨時休業日の登録（POST /api/admin/holidays）の入力チェック（docs/03）。
 *
 *   { "date": "2026-10-10", "reason": "設備点検", "cancel_reservations": false }
 *
 * - date … 今日以降（R1 は過去の日も登録できた）
 * - reason … 任意。休業の理由。施設都合のキャンセルのメールにも入る
 * - cancel_reservations … その日の予約をキャンセルしてよいか。省略したら false（まず確認を返す）
 */
final class StoreHolidayRequest extends FormRequest
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
            // today はアプリのタイムゾーン（日本時間）の今日
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            // holidays.reason は varchar(255)
            'reason' => ['nullable', 'string', 'max:255'],
            'cancel_reservations' => ['sometimes', 'boolean'],
        ];
    }

    /** 休業日（入力チェックを通った後に呼ぶ） */
    public function holidayDate(): CarbonImmutable
    {
        return CarbonImmutable::parse($this->string('date')->toString())->startOfDay();
    }

    /** 休業の理由。空なら null */
    public function reason(): ?string
    {
        $reason = $this->string('reason')->toString();

        return $reason === '' ? null : $reason;
    }
}
