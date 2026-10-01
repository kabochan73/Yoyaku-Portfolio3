<?php

declare(strict_types=1);

namespace App\Booking;

use Carbon\CarbonImmutable;

/**
 * 予約の時間帯（日付 + 開始の時 + 終了の時）を1つにまとめた値（docs/04 の「値オブジェクト: TimeSlot」）。
 *
 * 【D6】R1 は "10:00" のような文字列を substr で切り出して、時間数や重なりを計算していた。
 * R2 は「時」を整数で持ち、時間帯を1つの値として受け渡す。
 *
 * - 区間は [開始, 終了)。10〜12時 = startHour 10, endHour 12。12時ちょうどは含まない
 * - readonly（作った後は変更できない）。別の時間帯が必要なら新しく作る
 * - ここでは値が正しいか（営業時間内か など）は調べない。調べるのは BookingRules の役目
 *
 * 使い方: TimeSlot::on('2026-10-06', 10, 12)
 */
final readonly class TimeSlot
{
    /** 利用日（その日の 0:00） */
    public CarbonImmutable $date;

    /**
     * @param  CarbonImmutable  $date  利用日。時刻の部分は無視する（0:00 にそろえる）
     * @param  int  $startHour  開始の時（例: 10）
     * @param  int  $endHour  終了の時（例: 12。この時刻は含まない）
     */
    public function __construct(
        CarbonImmutable $date,
        public int $startHour,
        public int $endHour,
    ) {
        $this->date = $date->startOfDay();
    }

    /**
     * 文字列の日付から作る。日付はアプリのタイムゾーン（Asia/Tokyo）の日付として読む。
     *
     * @param  string  $date  'YYYY-MM-DD'
     */
    public static function on(string $date, int $startHour, int $endHour): self
    {
        return new self(CarbonImmutable::parse($date), $startHour, $endHour);
    }

    /** 利用時間（時間数）。例: 10〜12時なら 2 */
    public function hours(): int
    {
        return $this->endHour - $this->startHour;
    }

    /** 開始の日時。例: 2026-10-06 10:00 */
    public function startsAt(): CarbonImmutable
    {
        return $this->date->setTime($this->startHour, 0);
    }

    /** 土日か。料金（平日・土日）を決めるのに使う。祝日は判定しない（平日料金。docs/01） */
    public function isWeekend(): bool
    {
        return $this->date->isWeekend();
    }
}
