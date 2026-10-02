<?php

declare(strict_types=1);

namespace App\Queries;

use App\Booking\BookingRules;
use App\Booking\DayClosure;
use App\Enums\DayClosedReason;
use App\Enums\ReservationStatus;
use App\Enums\SlotStatus;
use App\Models\Reservation;
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
     * 管理者用（予約の詳細つき、受付外の日の予約も出す）は forAdmin()。
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
     * GET /api/admin/calendar 用。予約の詳細つき（docs/03・docs/04 の「カレンダーの組み立て」）。
     *
     * 日の判定（受付外の理由）は forPublic() と同じ。違うのは次の2つ:
     * - 受付外の日も全部の枠を返し、予約がある枠は Booked、ほかは Closed にする。
     *   【B11】R1 は受付外の日を Closed だけで返していたので、定休日を後から増やすと、
     *   その曜日に残った予約が管理カレンダーに出ず、キャンセルもできなかった
     * - その日の予約の一覧（予約者名・電話予約か・料金など）を付ける
     *
     * 保持期間（admin_lookback_months = 3か月）より前の日は、枠も予約も空にする。
     * それより前の予約は model:prune で消えているので、そもそもデータが無い。
     *
     * 事実は forPublic() と同じ CalendarFacts（Redis のキャッシュ）から読む。管理者用に別のキャッシュは作らない。
     *
     * @param  CarbonImmutable  $now  今の日時
     * @return list<AdminCalendarDay>
     */
    public function forAdmin(CarbonImmutable $from, CarbonImmutable $to, CarbonImmutable $now): array
    {
        $regularHolidays = $this->facts->regularHolidays();
        // 予約を残している最初の日（例: 今日が 10/6 なら 7/6。prunable() と同じ数え方）
        $oldestKept = $now->startOfDay()->subMonthsNoOverflow((int) config('facility.rules.admin_lookback_months'));

        $days = [];
        foreach ($this->facts->days($from, $to) as $date => $facts) {
            $date = CarbonImmutable::parse($date);
            $closedReason = $this->closedReason($date, $facts, $regularHolidays, $now);

            if ($date->lt($oldestKept)) {
                $days[] = new AdminCalendarDay($date, $closedReason, slots: [], reservations: []);

                continue;
            }

            $days[] = new AdminCalendarDay(
                date: $date,
                closedReason: $closedReason,
                slots: $this->adminSlots($date, $facts, $closedReason, $now),
                reservations: array_map(
                    fn (array $fact): Reservation => $this->toReservation($date, $fact),
                    $facts->reservations,
                ),
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

    /**
     * 管理者用の枠。全部の枠を返す。
     *
     * 1. 確定済みの予約が入っている → Booked（予約の id 付き）。受付外の日でも Booked（B11）
     * 2. 受付外の日                 → Closed
     * 3. 今日の、もう始まった枠     → Past
     * 4. それ以外                   → Available（電話予約で選べる）
     *
     * @return list<CalendarSlot>
     */
    private function adminSlots(
        CarbonImmutable $date,
        DayFacts $facts,
        ?DayClosedReason $closedReason,
        CarbonImmutable $now,
    ): array {
        $slots = [];
        for ($hour = $this->rules->openHour; $hour < $this->rules->closeHour; $hour++) {
            $reservation = $facts->reservationAt($hour);

            $status = match (true) {
                $reservation !== null => SlotStatus::Booked,
                $closedReason !== null => SlotStatus::Closed,
                $this->rules->isPastSlot($date, $hour, $now) => SlotStatus::Past,
                default => SlotStatus::Available,
            };

            $slots[] = new CalendarSlot($hour, $status, $reservation['id'] ?? null);
        }

        return $slots;
    }

    /**
     * キャッシュの事実（配列）から、予約のモデルを組み立てる（DB は読まない）。
     *
     * 返すときに AdminReservationResource を通し、段階（phase）・キャンセルできるか などを
     * 予約のモデルの同じメソッドで決めるため、配列のままにせずモデルにする。
     *
     * @param  array{id: int, start_hour: int, end_hour: int, booker_name: string, user_id: int|null, price: int}  $fact
     */
    private function toReservation(CarbonImmutable $date, array $fact): Reservation
    {
        $reservation = new Reservation;
        $reservation->forceFill([
            ...$fact,
            'date' => $date->toDateString(),
            // キャッシュに入っているのは確定済みの予約だけ（CalendarFacts）
            'status' => ReservationStatus::Confirmed,
        ]);
        // DB にある行として扱う（保存し直したりはしない）
        $reservation->exists = true;

        return $reservation;
    }
}
