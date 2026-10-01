<?php

declare(strict_types=1);

namespace App\Booking;

use App\Enums\DayClosedReason;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * 予約のルールのうち、DB を見ずに決まるもの（docs/04 の「予約できるかの判定」）。
 *
 * - 営業時間内か・長さが範囲内か・過去でないか・予約できる期間内か を調べる
 * - 定休日・臨時休業日かは DB を見るので、ここでは調べない（App\Queries\ClosedDays。3-6）
 * - 他の予約と重ならないか・1人1日1件かは、DB の制約が守る（B2・B3）
 *
 * ルールの値（営業時間など）は config/facility.php の rules から受け取る（D1）。
 * アプリの中では AppServiceProvider が config の値で1つ作って使い回す。
 * テストでは new BookingRules(...) で値を変えたものを作れる。
 *
 * 「今」は引数で受け取る（中で now() を呼ばない）。テストで時刻を自由に与えられ、
 * 時刻を固定する仕組みも DB も要らない。
 *
 * 会員の予約と電話予約の両方に、同じルールを当てる（2026-09-29 決定。docs/04）。
 */
final readonly class BookingRules
{
    /**
     * @param  int  $openHour  営業開始の時（例: 10）
     * @param  int  $closeHour  営業終了の時（例: 22。最後の枠は 21時台）
     * @param  int  $minHours  1回の予約の最短の時間数（例: 2）
     * @param  int  $maxHours  1回の予約の最長の時間数（例: 4）
     * @param  int  $bookingWindowMonths  何か月先まで予約できるか（例: 1）
     */
    public function __construct(
        public int $openHour,
        public int $closeHour,
        public int $minHours,
        public int $maxHours,
        public int $bookingWindowMonths,
    ) {}

    /**
     * config/facility.php の rules から作る。
     *
     * @param  array{open_hour: int, close_hour: int, min_hours: int, max_hours: int, booking_window_months: int}  $rules
     */
    public static function fromConfig(array $rules): self
    {
        return new self(
            openHour: $rules['open_hour'],
            closeHour: $rules['close_hour'],
            minHours: $rules['min_hours'],
            maxHours: $rules['max_hours'],
            bookingWindowMonths: $rules['booking_window_months'],
        );
    }

    /**
     * 時間帯が予約のルールを満たしているかを調べ、満たしていなければ 422 の項目エラーを投げる。
     *
     * 違反はまとめて返す（1つ直したら次のエラーが出る、を繰り返させない）。
     * エラーは ValidationException なので、フォームの入力エラーと同じ形で画面に届く（docs/03 の 422）。
     *
     * @param  CarbonImmutable  $now  今の日時
     *
     * @throws ValidationException
     */
    public function assertValidSlot(TimeSlot $slot, CarbonImmutable $now): void
    {
        /** @var array<string, string> $errors 項目名 => メッセージ */
        $errors = [];

        // 営業時間（例: 10:00〜22:00）の中に収まっているか
        if ($slot->startHour < $this->openHour || $slot->endHour > $this->closeHour) {
            $errors['start_hour'] = __('booking.outside_business_hours', [
                'open' => $this->formatHour($this->openHour),
                'close' => $this->formatHour($this->closeHour),
            ]);
        }

        // 長さ（例: 2〜4時間）
        if ($slot->hours() < $this->minHours || $slot->hours() > $this->maxHours) {
            $errors['end_hour'] = __('booking.invalid_length', [
                'min' => $this->minHours,
                'max' => $this->maxHours,
            ]);
        }

        // 日付（過去の日・予約できる期間より先の日）
        $reason = $this->dateClosedReason($slot->date, $now);
        if ($reason === DayClosedReason::Past) {
            $errors['date'] = __('booking.past_date');
        } elseif ($reason === DayClosedReason::OutOfRange) {
            $errors['date'] = __('booking.out_of_range', [
                'date' => $this->bookableUntil($now)->format('n月j日'),
            ]);
        }

        // 【B10】当日でも、開始時刻を過ぎた枠は予約できない。
        // R1 は日付しか見ていなかったので、15時に「今日の10〜12時」を予約できた。
        // 過去の日付はすでに上でエラーにしているので、ここでは重ねて出さない
        if ($reason === null && $this->isPastSlot($slot->date, $slot->startHour, $now)) {
            $errors['start_hour'] ??= __('booking.already_started');
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * 予約できる最終日（その日を含む）。
     *
     * 【B13】今日から booking_window_months（1か月）後の同日。1か月後に同じ日が無いときはその月の末日。
     * 例: 10/6 → 11/6、1/31 → 2/28（うるう年は 2/29）。
     * R1 はサーバーが addMonth()（1/31 → 3/3 に溢れる）、フロントが +31日で、最終日が一致していなかった。
     * フロントでは計算せず、カレンダー API でこの日付を渡す（docs/04 の「予約期間の定義」）。
     *
     * @param  CarbonImmutable  $now  今の日時（日付の部分だけを使う）
     */
    public function bookableUntil(CarbonImmutable $now): CarbonImmutable
    {
        return $now->startOfDay()->addMonthsNoOverflow($this->bookingWindowMonths);
    }

    /**
     * 日付だけで決まる「受付外」の理由。受付中の日付なら null。
     *
     * - 今日より前 → Past
     * - 予約できる最終日より先 → OutOfRange
     *
     * 定休日・臨時休業日（DB を見る）はここでは判定しない。
     * カレンダー（手順5）でも同じこの判定を使い、予約時とずれないようにする。
     *
     * @param  CarbonImmutable  $now  今の日時（日付の部分だけを使う）
     */
    public function dateClosedReason(CarbonImmutable $date, CarbonImmutable $now): ?DayClosedReason
    {
        $day = $date->startOfDay();

        if ($day->lt($now->startOfDay())) {
            return DayClosedReason::Past;
        }

        if ($day->gt($this->bookableUntil($now))) {
            return DayClosedReason::OutOfRange;
        }

        return null;
    }

    /**
     * その枠（日付 + 開始の時）が、もう始まっているか（B10）。
     * 開始時刻ちょうども「始まっている」とみなす（15:00 に 15時の枠は予約できない）。
     */
    public function isPastSlot(CarbonImmutable $date, int $hour, CarbonImmutable $now): bool
    {
        return $date->startOfDay()->setTime($hour, 0)->lte($now);
    }

    /** 時を "10:00" の形にする（メッセージ用） */
    private function formatHour(int $hour): string
    {
        return sprintf('%02d:00', $hour);
    }
}
