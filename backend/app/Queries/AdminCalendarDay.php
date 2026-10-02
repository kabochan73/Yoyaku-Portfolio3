<?php

declare(strict_types=1);

namespace App\Queries;

use App\Enums\DayClosedReason;
use App\Models\Reservation;
use Carbon\CarbonImmutable;

/**
 * 管理者用のカレンダーの1日（CalendarQuery::forAdmin が返す値。docs/03 の GET /admin/calendar）。
 *
 * 公開用の CalendarDay との違い:
 * - 受付外の日も、営業時間の全部の枠を持つ（予約がある枠は Booked、ほかは Closed。B11）
 * - その日の確定済みの予約の一覧（reservations）を持つ。枠には予約の id だけを付け、
 *   2〜4枠にまたがる予約の中身を枠ごとに重ねて持たない
 */
final readonly class AdminCalendarDay
{
    /**
     * @param  DayClosedReason|null  $closedReason  受付外の理由。受付中なら null
     * @param  list<CalendarSlot>  $slots  営業時間の1時間ごとの枠。保持期間（3か月）より前の日は空
     * @param  list<Reservation>  $reservations  その日の確定済みの予約（開始の早い順）。保持期間より前の日は空
     */
    public function __construct(
        public CarbonImmutable $date,
        public ?DayClosedReason $closedReason,
        public array $slots,
        public array $reservations,
    ) {}
}
