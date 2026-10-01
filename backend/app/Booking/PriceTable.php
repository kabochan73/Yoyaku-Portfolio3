<?php

declare(strict_types=1);

namespace App\Booking;

use App\Enums\PriceType;

/**
 * 料金表（平日・土日の1時間あたりの単価）。変更できない値。
 *
 * DB の prices の2行から作る（App\Models\Price::table()）。
 * 料金の計算もここで行う: Price::table()->priceFor($slot)
 *
 * 設計書では計算を別のクラス（PriceCalculator）に分けていたが、計算は「単価 × 時間数」だけで
 * 持つべき状態も無いので、料金表に持たせて1つにまとめた（2026-10-01。docs/04）。
 *
 * 料金の正はサーバー（D8）。フロントは /api/facility の単価で見積もりを表示するだけで、
 * 予約に保存する金額は、予約を作るときにここで計算する。
 */
final readonly class PriceTable
{
    /**
     * @param  int  $weekday  平日の1時間あたりの単価（円）
     * @param  int  $weekend  土日の1時間あたりの単価（円）
     */
    public function __construct(
        public int $weekday,
        public int $weekend,
    ) {}

    /**
     * その時間帯の合計金額（円）= その日の単価 × 時間数。
     * 例: 平日 4,000円で 10〜12時 → 8,000円
     */
    public function priceFor(TimeSlot $slot): int
    {
        return $this->unitPrice($this->typeFor($slot)) * $slot->hours();
    }

    /**
     * その時間帯に使う単価の種類。土日なら Weekend、それ以外は Weekday。
     * 祝日は判定しない（平日料金。R1 と同じ。docs/01）。
     */
    public function typeFor(TimeSlot $slot): PriceType
    {
        return $slot->isWeekend() ? PriceType::Weekend : PriceType::Weekday;
    }

    /** 種類ごとの1時間あたりの単価（円） */
    public function unitPrice(PriceType $type): int
    {
        return match ($type) {
            PriceType::Weekday => $this->weekday,
            PriceType::Weekend => $this->weekend,
        };
    }
}
