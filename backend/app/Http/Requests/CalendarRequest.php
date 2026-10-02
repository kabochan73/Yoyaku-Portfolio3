<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * カレンダー（GET /api/calendar?from=2026-10-05&to=2026-10-11）の入力チェック（docs/03）。
 *
 * - from・to は必須で、'2026-10-05' の形
 * - to は from と同じ日か、それより後
 * - 期間は最大14日（画面は1週間ずつ取る。2週間までまとめて取れるようにしておく）
 *
 * 期間に上限を付けるのは、1回の呼び出しで何か月分も読ませないため（DB とキャッシュの読み出しが増える）。
 */
final class CalendarRequest extends FormRequest
{
    /** 1回で取れる最大の日数（from と to を含む） */
    private const MAX_DAYS = 14;

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
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ];
    }

    /**
     * 上の rules() を通った後に行うチェック。期間の日数を調べる。
     *
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                // from・to のどちらかがすでにエラーなら、日数は数えない（エラーを重ねて出さない）
                if ($validator->errors()->hasAny(['from', 'to'])) {
                    return;
                }

                // from と to を両方含めた日数。例: 10/5〜10/11 → 7日
                $days = (int) $this->fromDate()->diffInDays($this->toDate()) + 1;

                if ($days > self::MAX_DAYS) {
                    $validator->errors()->add('to', __('booking.calendar_range_too_long', ['days' => self::MAX_DAYS]));
                }
            },
        ];
    }

    /** 期間の最初の日（入力チェックを通った後に呼ぶ） */
    public function fromDate(): CarbonImmutable
    {
        return CarbonImmutable::parse($this->string('from')->toString())->startOfDay();
    }

    /** 期間の最後の日（入力チェックを通った後に呼ぶ） */
    public function toDate(): CarbonImmutable
    {
        return CarbonImmutable::parse($this->string('to')->toString())->startOfDay();
    }
}
