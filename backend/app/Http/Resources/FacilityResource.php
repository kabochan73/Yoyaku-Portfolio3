<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Booking\PriceTable;
use App\Models\Price;
use App\Models\RegularHoliday;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 施設情報を API で返すときの形（docs/03 の GET /facility）。
 *
 *   { "data": { "name": …, "phone": …, "address": …, "email": …,
 *               "rules": { "open_hour": 10, … }, "prices": { "weekday": 4000, "weekend": 5000 },
 *               "regular_holidays": [1] } }
 *
 * フロントはここから営業時間・利用時間・料金・定休日を受け取り、自分では持たない（D1）。
 * 施設名・連絡先も、画面・メールで同じ値を使う（D14）。
 *
 * 使う場所:
 * - GET /api/facility（手順5）
 * - PUT /api/admin/prices・PUT /api/admin/regular-holidays の「更新後の施設情報」（手順7）
 * どちらも FacilityResource::current() で、今の値を集めて返す。
 */
final class FacilityResource extends JsonResource
{
    /**
     * @param  PriceTable  $prices  料金表（DB の prices）
     * @param  list<int>  $regularHolidays  定休日の曜日（0 = 日曜 … 6 = 土曜。小さい順）
     */
    public function __construct(
        private readonly PriceTable $prices,
        private readonly array $regularHolidays,
    ) {
        parent::__construct($prices);
    }

    /**
     * 今の施設情報を DB と config から集める。
     *
     * 料金の行が足りなければ Price::table() が例外を投げ、500 になる
     * （0円の料金を表示するより、止めて気づける方がよい。Price::table() のコメント）。
     */
    public static function current(): self
    {
        return new self(Price::table(), RegularHoliday::days());
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            // 施設名・連絡先（config/facility.php。D14）
            'name' => config('facility.name'),
            'phone' => config('facility.phone'),
            'address' => config('facility.address'),
            'email' => config('facility.email'),

            // カレンダーの描画と、フロントでの入力チェックに使うルール（config/facility.php。D1）。
            // 管理画面だけで使う admin_lookback_months は返さない
            'rules' => [
                'open_hour' => config('facility.rules.open_hour'),
                'close_hour' => config('facility.rules.close_hour'),
                'min_hours' => config('facility.rules.min_hours'),
                'max_hours' => config('facility.rules.max_hours'),
                'booking_window_months' => config('facility.rules.booking_window_months'),
            ],

            // 1時間あたりの単価（円）。フロントはこれで見積もりを出すだけで、確定の金額はサーバーが計算する（D8）
            'prices' => [
                'weekday' => $this->prices->weekday,
                'weekend' => $this->prices->weekend,
            ],

            'regular_holidays' => $this->regularHolidays,
        ];
    }
}
