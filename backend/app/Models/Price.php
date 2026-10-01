<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\PriceType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * 料金。平日（Weekday）と土日（Weekend）の2行だけを持つ（docs/02 の prices）。
 *
 * 料金を計算に使うときは、2行をまとめて値オブジェクト（PriceTable）にして渡す。
 * そのための Price::table() は、PriceTable を作る 3-5 で足す。
 */
#[Fillable(['type', 'amount_per_hour'])]
final class Price extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // 文字列 'weekday' を PriceType::Weekday（Enum）にする（D3）
            'type' => PriceType::class,
            // 1時間あたりの料金（円）
            'amount_per_hour' => 'integer',
        ];
    }
}
