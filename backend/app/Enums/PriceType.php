<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * 料金の種類（docs/02 の prices.type）。
 *
 * 予約日が土日なら Weekend、それ以外（祝日を含む）は Weekday の単価を使う（docs/01）。
 * どちらになるかの判定は、料金の計算（App\Booking\PriceCalculator。3-5 で作る）が行う。
 * DB の CHECK 制約にも同じ値を直接書いている（値を増やすときは CHECK 制約も張り替える）。
 */
enum PriceType: string
{
    /** 平日（月〜金。祝日も平日料金） */
    case Weekday = 'weekday';

    /** 土日 */
    case Weekend = 'weekend';
}
