<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * 料金の更新（PUT /api/admin/prices）の入力チェック（docs/03）。
 *
 *   { "weekday": 4000, "weekend": 5000 }
 *
 * 両方必須・0以上の整数（DB の CHECK 制約 amount_per_hour >= 0 と同じ）。
 * 空欄は 422（R1 は空欄が Number("") = 0円で保存された。B16）。
 */
final class UpdatePricesRequest extends FormRequest
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
            // 上限は、桁を打ち間違えたときに気づけるように（1時間 100万円）
            'weekday' => ['required', 'integer', 'between:0,1000000'],
            'weekend' => ['required', 'integer', 'between:0,1000000'],
        ];
    }
}
