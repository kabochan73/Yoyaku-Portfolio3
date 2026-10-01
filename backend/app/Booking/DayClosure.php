<?php

declare(strict_types=1);

namespace App\Booking;

use App\Enums\DayClosedReason;
use Carbon\CarbonImmutable;

/**
 * 定休日・臨時休業日の判定ルール（DB に触らない）。docs/04 の「予約できるかの判定」。
 *
 * 判定に使う値（定休日の曜日の一覧・臨時休業日か）は、呼ぶ側が用意して渡す。
 * - 予約時      … App\Queries\ClosedDays が DB から直接読んで渡す（正確さが必要なので、キャッシュを使わない）
 * - カレンダー  … 手順5の CalendarFacts が Redis のキャッシュから読んで渡す
 * どちらも同じこのルールを使うので、「カレンダーでは空いて見えるのに予約すると弾かれる」ずれが起きない。
 * R1 は予約時（ReservationController）とカレンダー（CalendarController）で別々に判定を書いていた。
 *
 * 過去の日・予約期間外（日付と「今」だけで決まるもの）は BookingRules::dateClosedReason() が判定する。
 */
final class DayClosure
{
    /**
     * その日が休みなら理由を、営業日なら null を返す。
     *
     * 定休日と臨時休業日の両方に当たるときは、定休日を優先する（カレンダーの判定順。docs/04）。
     * 例: 月曜（定休日）に臨時休業日も登録されていた → RegularHoliday
     *
     * @param  CarbonImmutable  $date  調べる日
     * @param  list<int>  $regularHolidays  定休日の曜日の一覧（0 = 日曜 … 6 = 土曜）。定休日なしなら []
     * @param  bool  $isHoliday  その日が臨時休業日か
     */
    public static function reason(CarbonImmutable $date, array $regularHolidays, bool $isHoliday): ?DayClosedReason
    {
        if (in_array($date->dayOfWeek, $regularHolidays, true)) {
            return DayClosedReason::RegularHoliday;
        }

        if ($isHoliday) {
            return DayClosedReason::Holiday;
        }

        return null;
    }
}
