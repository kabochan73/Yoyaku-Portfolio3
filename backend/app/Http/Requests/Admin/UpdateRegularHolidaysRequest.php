<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * 定休日の更新（PUT /api/admin/regular-holidays）の入力チェック（docs/03）。
 *
 *   { "days": [1, 3] }
 *
 * - days は必ず送る（present）。空の配列は「定休日なし」として許す
 * - 各値は 0〜6 の整数（0 = 日曜 … 6 = 土曜）で、重複しない（distinct）
 */
final class UpdateRegularHolidaysRequest extends FormRequest
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
            'days' => ['present', 'array'],
            'days.*' => ['integer', 'between:0,6', 'distinct'],
        ];
    }

    /**
     * 曜日の一覧（入力チェックを通った後に呼ぶ）。
     *
     * @return list<int>
     */
    public function days(): array
    {
        /** @var list<int|string> $days */
        $days = $this->input('days', []);

        return array_map(intval(...), $days);
    }
}
