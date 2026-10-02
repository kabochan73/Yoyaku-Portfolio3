<?php

declare(strict_types=1);

namespace App\Queries;

use App\Booking\BookingRules;
use App\Booking\DayClosure;
use App\Enums\DayClosedReason;
use App\Enums\SlotStatus;
use Carbon\CarbonImmutable;

/**
 * カレンダーの組み立て（docs/04 の「カレンダーの組み立て」）。
 *
 * 事実（CalendarFacts。Redis にキャッシュ）と「今」から、日ごとの受付の可否と、枠ごとの状態を決める。
 * 時間で変わる判定（過去・予約期間外）は、キャッシュに入れずに、ここで毎回計算する。
 *
 * 判定には予約時の検査と同じルール（BookingRules・DayClosure）を使う。
 * 「カレンダーでは空いて見えるのに、予約すると 422 になる」ずれを起こさないため。
 * R1 はカレンダー（CalendarController）と予約時（ReservationController）で判定を別々に書いていた。
 *
 * 「今」は引数で受け取る（中で now() を呼ばない。BookingRules と同じ）。テストで時刻を自由に与えられる。
 */
final readonly class CalendarQuery
{
    public function __construct(
        private CalendarFacts $facts,
        private BookingRules $rules,
    ) {}

    /**
     * GET /api/calendar 用。誰が呼んでも同じ内容（2026-09-29 決定）。
     *
     * - 受付中の日 … 営業時間の1時間ごとの枠を返す
     * - 受付外の日 … 枠を返さない（予約の有無も見せない）
     *
     * 管理者用（予約の詳細つき、受付外の日の予約も出す）の forAdmin() は手順7で足す。
     *
     * @param  CarbonImmutable  $now  今の日時
     * @return list<CalendarDay>
     */
    public function forPublic(CarbonImmutable $from, CarbonImmutable $to, CarbonImmutable $now): array
    {
        $regularHolidays = $this->facts->regularHolidays();

        $days = [];
        foreach ($this->facts->days($from, $to) as $date => $facts) {
            $date = CarbonImmutable::parse($date);
            $closedReason = $this->closedReason($date, $facts, $regularHolidays, $now);

            $days[] = new CalendarDay(
                date: $date,
                closedReason: $closedReason,
                slots: $closedReason === null ? $this->slots($date, $facts, $now) : [],
            );
        }

        return $days;
    }

    /**
     * その日を受け付けない理由。受付中なら null。
     *
     * 上から順に調べ、最初に当たったものを使う（docs/04 の判定順）:
     * 1. 今日より前                → Past
     * 2. 予約期間より先            → OutOfRange   … 1・2 は BookingRules（日付と「今」で決まる）
     * 3. 定休日                    → RegularHoliday
     * 4. 臨時休業日                → Holiday      … 3・4 は DayClosure（予約時の ClosedDays と同じルール）
     *
     * @param  list<int>  $regularHolidays
     */
    private function closedReason(
        CarbonImmutable $date,
        DayFacts $facts,
        array $regularHolidays,
        CarbonImmutable $now,
    ): ?DayClosedReason {
        return $this->rules->dateClosedReason($date, $now)
            ?? DayClosure::reason($date, $regularHolidays, $facts->isHoliday);
    }

    /**
     * 受付中の日の、営業時間の1時間ごとの枠（例: 10〜21時の12枠）。
     *
     * 枠ごとに、上から順に調べる:
     * 1. 確定済みの予約が入っている → Booked
     * 2. 今日の、もう始まった枠     → Past（B10。BookingRules::isPastSlot。予約時の検査と同じ）
     * 3. それ以外                   → Available
     *
     * 予約済みを過去より先に見るのは、始まった後でも「予約が入っていた」ことは変わらないため
     * （管理者用のカレンダーで、今日の予約を出すときに同じ順番を使う）。
     *
     * @return list<CalendarSlot>
     */
    private function slots(CarbonImmutable $date, DayFacts $facts, CarbonImmutable $now): array
    {
        $slots = [];
        for ($hour = $this->rules->openHour; $hour < $this->rules->closeHour; $hour++) {
            $status = match (true) {
                $facts->isBooked($hour) => SlotStatus::Booked,
                $this->rules->isPastSlot($date, $hour, $now) => SlotStatus::Past,
                default => SlotStatus::Available,
            };

            $slots[] = new CalendarSlot($hour, $status);
        }

        return $slots;
    }
}
