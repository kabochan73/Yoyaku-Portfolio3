<?php

declare(strict_types=1);

namespace App\Queries;

use App\Booking\DayClosure;
use App\Enums\DayClosedReason;
use App\Models\Holiday;
use App\Models\RegularHoliday;
use Carbon\CarbonImmutable;

/**
 * 予約時の「定休日・臨時休業日か」の判定。DB を直接見る（docs/04 の「予約できるかの判定」）。
 *
 * - 予約の可否は正確でなければならないので、Redis のキャッシュは使わない（docs/04 の「キャッシュ方針」）
 * - 判定のルールそのものは DayClosure にあり、カレンダーと共通
 * - 予約の作成（手順6の CreateReservation）では、日付ごとのロックを取った後にこれを呼ぶ。
 *   臨時休業日の登録と同時に来ても、休業日に予約が残らないようにするため（docs/04 の「臨時休業日との競合」）
 */
final class ClosedDays
{
    /**
     * その日が休みなら理由（RegularHoliday / Holiday）を、営業日なら null を返す。
     */
    public function reasonFor(CarbonImmutable $date): ?DayClosedReason
    {
        /** @var list<int> $regularHolidays */
        $regularHolidays = RegularHoliday::query()->pluck('day_of_week')->all();

        $isHoliday = Holiday::query()->whereDate('date', $date->toDateString())->exists();

        return DayClosure::reason($date, $regularHolidays, $isHoliday);
    }
}
