<?php

declare(strict_types=1);

namespace App\Models;

use App\Booking\PriceTable;
use App\Enums\PriceType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use RuntimeException;

/**
 * 料金。平日（Weekday）と土日（Weekend）の2行だけを持つ（docs/02 の prices）。
 *
 * 料金を計算に使うときは、2行をまとめて値オブジェクト（PriceTable）にする: Price::table()->priceFor($slot)
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

    /**
     * DB の2行（平日・土日）を読んで、料金表（PriceTable）にして返す。
     *
     * 行が足りなければ例外にする。R1 は行が無いと単価が null になり、
     * 「null × 時間 = 0円」の予約ができてしまった。0円の予約を作るより、ここで止めて気づける方がよい。
     * 行は InitialDataSeeder で作る。本番で失敗したら、シーダーを流し忘れていないかを確かめる。
     *
     * @throws RuntimeException 平日・土日のどちらかの行が無いとき
     */
    public static function table(): PriceTable
    {
        // [種類の文字列 => 単価] の形で読む。例: ['weekday' => 4000, 'weekend' => 5000]
        $amounts = self::query()->pluck('amount_per_hour', 'type')->all();

        foreach (PriceType::cases() as $type) {
            if (! array_key_exists($type->value, $amounts)) {
                throw new RuntimeException(
                    "料金（{$type->value}）が設定されていません。InitialDataSeeder を流したか確かめてください。"
                );
            }
        }

        return new PriceTable(
            weekday: (int) $amounts[PriceType::Weekday->value],
            weekend: (int) $amounts[PriceType::Weekend->value],
        );
    }
}
