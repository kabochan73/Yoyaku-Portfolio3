<?php

declare(strict_types=1);

namespace App\Queries;

/**
 * 1日分の「事実」: その日の確定済みの予約と、臨時休業日かどうか（docs/04 の「キャッシュ方針」）。
 *
 * 書き込み（予約・キャンセル・臨時休業日の登録や削除）でしか変わらない値だけを持つ。
 * 「過去の枠か」「予約できる期間か」のように時間で変わる判定は持たない（CalendarQuery が読むたびに計算する）。
 *
 * Redis には、このクラスのままではなく toArray() の配列で保存する。
 * オブジェクトのまま保存すると、後でこのクラスの形を変えたときに、古いキャッシュが読めなくなるため。
 *
 * @phpstan-type ReservationFact array{id: int, start_hour: int, end_hour: int, booker_name: string, user_id: int|null, price: int}
 * @phpstan-type DayFactsArray array{reservations: list<ReservationFact>, is_holiday: bool, holiday_reason: string|null}
 */
final readonly class DayFacts
{
    /**
     * @param  list<ReservationFact>  $reservations  その日の確定済みの予約（開始の早い順）。
     *                                               予約者名・料金は管理者用のカレンダー（手順7）で使う
     * @param  bool  $isHoliday  臨時休業日か
     * @param  string|null  $holidayReason  臨時休業日の理由（管理画面に出す。理由なしなら null）
     */
    public function __construct(
        public array $reservations,
        public bool $isHoliday,
        public ?string $holidayReason,
    ) {}

    /**
     * その時（例: 12 = 12時台の枠）に、確定済みの予約が入っているか。
     * 10〜12時の予約なら、10 と 11 が予約済み（12 は含まない）。
     */
    public function isBooked(int $hour): bool
    {
        foreach ($this->reservations as $reservation) {
            if ($reservation['start_hour'] <= $hour && $hour < $reservation['end_hour']) {
                return true;
            }
        }

        return false;
    }

    /**
     * キャッシュに保存する形にする。
     *
     * @return DayFactsArray
     */
    public function toArray(): array
    {
        return [
            'reservations' => $this->reservations,
            'is_holiday' => $this->isHoliday,
            'holiday_reason' => $this->holidayReason,
        ];
    }

    /**
     * キャッシュから読んだ配列から作る。
     *
     * @param  DayFactsArray  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            reservations: $data['reservations'],
            isHoliday: $data['is_holiday'],
            holidayReason: $data['holiday_reason'],
        );
    }
}
