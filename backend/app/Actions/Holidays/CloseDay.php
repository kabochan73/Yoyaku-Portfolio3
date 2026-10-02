<?php

declare(strict_types=1);

namespace App\Actions\Holidays;

use App\Actions\Reservations\CancelReservation;
use App\Enums\CancellationReason;
use App\Events\HolidayChanged;
use App\Exceptions\ConflictException;
use App\Models\Holiday;
use App\Models\Reservation;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * 臨時休業日を登録する（docs/04 の「臨時休業日の登録」、docs/01 の 6.4）。
 *
 * 全体を1つのトランザクションで行う（B7）。途中で失敗したら、予約も休業日も元のままで、メールも1通も送られない。
 * R1 は Controller の foreach で1件ずつキャンセルしていて、トランザクションが無かった
 * （途中で失敗すると、一部の予約だけキャンセルされ、メールも送られてしまった）。
 *
 *   1. その日付のロックを取る（予約の作成と同じロック。Reservation::lockDate()）
 *   2. その日の「確定済み かつ 開始前」の予約を、行ロックして読む
 *   3. 予約があって、まだ確認していなければ → 409 holiday_has_reservations（件数）
 *   4. holidays に INSERT（同じ日がある → 409 holiday_already_exists）
 *   5. 予約を1件ずつキャンセル（理由は臨時休業日。メールに休業の理由を入れる）
 *   6. HolidayChanged を出す（その日のカレンダーのキャッシュを消す）
 *
 * 今日以降の日付だけ登録できる（入力チェックは StoreHolidayRequest。R1 は過去の日も登録できた）。
 */
final readonly class CloseDay
{
    public function __construct(
        private CancelReservation $cancelReservation,
    ) {}

    /**
     * @param  string|null  $reason  休業の理由（例: 設備点検）。メールにも入る
     * @param  bool  $cancelReservations  その日の予約をキャンセルしてよいと、管理者が確認したか
     *
     * @throws ConflictException 予約がある（未確認）・すでに休業日（409）
     */
    public function handle(CarbonImmutable $date, ?string $reason, bool $cancelReservations): Holiday
    {
        return DB::transaction(function () use ($date, $reason, $cancelReservations): Holiday {
            Reservation::lockDate($date);

            $reservations = $this->reservationsToCancel($date);

            if ($reservations !== [] && ! $cancelReservations) {
                throw ConflictException::holidayHasReservations(count($reservations));
            }

            $holiday = $this->insertHoliday($date, $reason);

            foreach ($reservations as $reservation) {
                // CancelReservation の中のトランザクションは、このトランザクションの一部になる（入れ子）。
                // メールの Listener も、外側の commit の後に動く
                $this->cancelReservation->handle($reservation, CancellationReason::ByHoliday, $reason);
            }

            HolidayChanged::dispatch($date);

            return $holiday;
        });
    }

    /**
     * その日の、キャンセルする予約（確定済み かつ 開始前）。行ロックを付けて読む。
     *
     * 【B14】開始済みの予約（利用中・利用済み）は最初から除く。
     * 当日を休業日にしても、もう始まった予約は利用実績として残す。
     * 含めてしまうと、CancelReservation の「開始前だけ」の検査に当たって登録全体が失敗し、
     * 確認の件数も、実際にキャンセルされる件数とずれる。
     *
     * @return list<Reservation>
     */
    private function reservationsToCancel(CarbonImmutable $date): array
    {
        $now = now()->toImmutable();

        return Reservation::query()
            ->confirmed()
            ->whereDate('date', $date->toDateString())
            ->orderBy('start_hour')
            ->lockForUpdate()
            ->get()
            ->filter(fn (Reservation $reservation): bool => $reservation->isCancellable($now))
            ->values()
            ->all();
    }

    /**
     * 休業日を INSERT する。同じ日がすでにあれば 409。
     * 先に「あるか」を調べず、DB の一意制約に任せる（予約の B2 と同じ考え方）。
     */
    private function insertHoliday(CarbonImmutable $date, ?string $reason): Holiday
    {
        try {
            return Holiday::query()->create([
                'date' => $date->toDateString(),
                'reason' => $reason,
            ]);
        } catch (QueryException $e) {
            if ($e->getCode() === '23505' && str_contains($e->getMessage(), 'holidays_date_unique')) {
                throw ConflictException::holidayAlreadyExists();
            }
            throw $e;
        }
    }
}
