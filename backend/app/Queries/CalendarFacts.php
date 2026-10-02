<?php

declare(strict_types=1);

namespace App\Queries;

use App\Models\Holiday;
use App\Models\RegularHoliday;
use App\Models\Reservation;
use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\Cache;

/**
 * @phpstan-import-type DayFactsArray from DayFacts
 *
 * カレンダーに使う「事実」の読み出し。Redis に日ごとに60秒キャッシュする（docs/04 の「キャッシュ方針」、D7）。
 *
 * 目的は、カレンダーの DB アクセスを減らすこと。画面は60秒ごとに取り直すので、
 * キャッシュが無いと DB アクセスが見ている人数に比例して増える。
 * キャッシュがあれば、何人が同じ週を見ていても、DB を読むのは期限切れの後の最初の1人だけになる。
 *
 * | キー                        | 中身                                       |
 * |-----------------------------|--------------------------------------------|
 * | calendar:day:2026-10-06     | その日の確定済みの予約・臨時休業日か（DayFacts） |
 * | calendar:regular_holidays   | 定休日の曜日の一覧                         |
 *
 * - 入れるのは書き込みでしか変わらない事実だけ。時間で変わる判定は CalendarQuery が読むたびに計算する
 * - 書き込みがあった日は、commit の直後に forgetDay() で消す（手順6・7。ForgetCalendarCache）
 * - 予約時の可否の判定には使わない（ClosedDays と DB の制約で、必ず DB を見る）
 *
 * R1 は「月 × 今日の日付 × 権限」ごとに完成したカレンダーをキャッシュし、
 * 変更のたびに Cache::tags(['calendar'])->flush() で全部を消していた。
 */
final class CalendarFacts
{
    /** 定休日の一覧のキー */
    private const REGULAR_HOLIDAYS_KEY = 'calendar:regular_holidays';

    /**
     * $from〜$to（両端を含む）の日ごとの事実。キーは日付（'2026-10-06'）、日付の順。
     *
     * 1. 期間の全部の日のキーを、まとめて1回で読む（Cache::many）
     * 2. キャッシュに無かった日だけ、DB からまとめて読む（予約・臨時休業日それぞれ1回）
     * 3. 読んだ日をまとめて保存する（Cache::putMany）
     *
     * @return array<string, DayFacts>
     */
    public function days(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $dates = $this->datesBetween($from, $to);
        if ($dates === []) {
            return [];
        }

        // [キー => 保存してある配列 or null（無い）]
        $cached = Cache::many(array_map($this->dayKey(...), $dates));

        /** @var array<string, DayFacts> $facts */
        $facts = [];
        $missing = [];

        foreach ($dates as $date) {
            /** @var DayFactsArray|null $data */
            $data = $cached[$this->dayKey($date)] ?? null;

            if ($data === null) {
                $missing[] = $date;
            } else {
                $facts[$date] = DayFacts::fromArray($data);
            }
        }

        if ($missing !== []) {
            $loaded = $this->loadDays($missing);

            Cache::putMany(
                array_combine(
                    array_map($this->dayKey(...), array_keys($loaded)),
                    array_map(fn (DayFacts $day): array => $day->toArray(), $loaded),
                ),
                $this->ttl(),
            );

            $facts += $loaded;
        }

        // キャッシュから読んだ日と DB から読んだ日が混ざっているので、日付の順に並べ直す
        ksort($facts);

        return $facts;
    }

    /**
     * 定休日の曜日の一覧（0 = 日曜 … 6 = 土曜。小さい順）。
     *
     * @return list<int>
     */
    public function regularHolidays(): array
    {
        /** @var list<int> */
        return Cache::remember(self::REGULAR_HOLIDAYS_KEY, $this->ttl(), RegularHoliday::days(...));
    }

    /**
     * その日のキャッシュを消す。次に読んだ人が DB から取り直す。
     * 予約・キャンセル・電話予約・臨時休業日の登録や削除の commit の直後に呼ぶ（手順6・7）。
     */
    public function forgetDay(CarbonImmutable $date): void
    {
        Cache::forget($this->dayKey($date->toDateString()));
    }

    /**
     * 定休日の一覧のキャッシュを消す。定休日を変えたときに呼ぶ（手順7）。
     */
    public function forgetRegularHolidays(): void
    {
        Cache::forget(self::REGULAR_HOLIDAYS_KEY);
    }

    /**
     * キャッシュに無かった日の事実を DB から読む。日数に関係なく、問い合わせは予約・臨時休業日の2回だけ。
     *
     * @param  non-empty-list<string>  $dates  日付（'2026-10-06'）の一覧。日付の順
     * @return array<string, DayFacts>
     */
    private function loadDays(array $dates): array
    {
        // 確定済みの予約（キャンセル済みはカレンダーに関係しない）
        $reservations = Reservation::query()
            ->confirmed()
            ->whereIn('date', $dates)
            ->orderBy('start_hour')
            ->get(['id', 'date', 'start_hour', 'end_hour', 'booker_name', 'user_id', 'price'])
            ->groupBy(fn (Reservation $reservation): string => $reservation->date->toDateString());

        // 臨時休業日 [日付 => 理由]
        $holidays = Holiday::query()
            ->whereIn('date', $dates)
            ->get(['date', 'reason'])
            ->mapWithKeys(fn (Holiday $holiday): array => [$holiday->date->toDateString() => $holiday->reason]);

        $facts = [];
        foreach ($dates as $date) {
            $facts[$date] = new DayFacts(
                reservations: $reservations->get($date, collect())
                    ->map(fn (Reservation $reservation): array => [
                        'id' => $reservation->id,
                        'start_hour' => $reservation->start_hour,
                        'end_hour' => $reservation->end_hour,
                        'booker_name' => $reservation->booker_name,
                        'user_id' => $reservation->user_id,
                        'price' => $reservation->price,
                    ])
                    ->values()
                    ->all(),
                isHoliday: $holidays->has($date),
                holidayReason: $holidays->get($date),
            );
        }

        return $facts;
    }

    /**
     * $from〜$to の日付（'2026-10-06'）の一覧。$from が $to より後なら空。
     *
     * @return list<string>
     */
    private function datesBetween(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $dates = [];
        foreach (CarbonPeriod::create($from->startOfDay(), $to->startOfDay()) as $date) {
            $dates[] = $date->toDateString();
        }

        return $dates;
    }

    /** 日ごとのキー。例: 'calendar:day:2026-10-06' */
    private function dayKey(string $date): string
    {
        return "calendar:day:{$date}";
    }

    /** キャッシュの期限（秒）。config/facility.php の calendar_cache_ttl（60秒） */
    private function ttl(): int
    {
        return (int) config('facility.calendar_cache_ttl');
    }
}
