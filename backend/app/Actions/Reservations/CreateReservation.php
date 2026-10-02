<?php

declare(strict_types=1);

namespace App\Actions\Reservations;

use App\Booking\BookingRules;
use App\Booking\TimeSlot;
use App\Enums\ReservationStatus;
use App\Events\ReservationCreated;
use App\Exceptions\ConflictException;
use App\Models\Price;
use App\Models\Reservation;
use App\Models\User;
use App\Queries\CalendarFacts;
use App\Queries\ClosedDays;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * 予約を作る（docs/04 の「予約の作成」）。
 *
 * 1つのトランザクションの中で、次の順に行う:
 *   1. その日付のロックを取る（臨時休業日の登録と同時に起きても、休業日に予約が残らないように）
 *   2. ルールの検査（BookingRules。営業時間・長さ・過去・予約期間）       … 違反は 422
 *   3. 定休日・臨時休業日の検査（ClosedDays。DB を直接見る）              … 違反は 422
 *   4. 料金を計算して INSERT。重なり・1人1日1件は DB の制約に任せる     … 違反は 409
 *   5. ReservationCreated を出す（メール・キャッシュの削除は Listener。6-4）
 *
 * 会員の予約（forMember）と電話予約（forPhone）で、同じルールを使う（2026-09-29 決定）。
 * 違いは「予約者名をどこから取るか」と「会員と結びつけるか」だけ。
 */
final readonly class CreateReservation
{
    public function __construct(
        private BookingRules $rules,
        private ClosedDays $closedDays,
        private CalendarFacts $calendarFacts,
    ) {}

    /**
     * 会員の予約。予約者名は会員の名前（予約した時点の名前を保存する。docs/01 の R10）。
     *
     * @throws ValidationException ルール違反（422）
     * @throws ConflictException 時間帯が埋まっていた・同じ日に予約がある（409）
     */
    public function forMember(User $user, TimeSlot $slot): Reservation
    {
        return $this->create($slot, $user->name, $user);
    }

    /**
     * 電話予約（管理者の代理登録。docs/01 の 6.1）。予約者名は管理者が入力した名前で、会員とは結びつけない。
     *
     * ルールは会員の予約と同じ（営業時間・長さ・過去・予約期間・定休日・重なり）。
     * ただし会員と結びつけない（user_id が null）ので、1人1日1件の制限（B3）は対象外になる
     * （DB の部分ユニーク索引が、user_id のある予約にだけ効くため）。完了メールも送らない（6-4 の Listener）。
     *
     * @throws ValidationException ルール違反（422）
     * @throws ConflictException 時間帯が埋まっていた（409）
     */
    public function forPhone(string $bookerName, TimeSlot $slot): Reservation
    {
        return $this->create($slot, $bookerName, null);
    }

    /**
     * @param  User|null  $user  予約した会員。電話予約なら null
     */
    private function create(TimeSlot $slot, string $bookerName, ?User $user): Reservation
    {
        try {
            return DB::transaction(function () use ($slot, $bookerName, $user): Reservation {
                $this->lockDate($slot);

                $this->rules->assertValidSlot($slot, now()->toImmutable());
                // ロックを取った後に調べる（下の lockDate() の説明）
                $this->assertOpen($slot);

                $reservation = $this->insert($slot, $bookerName, $user);

                // Listener は commit の後に動く（ShouldHandleEventsAfterCommit。6-4）。
                // ここで例外が起きてロールバックしたら、メールは送られない（B8）
                ReservationCreated::dispatch($reservation);

                return $reservation;
            });
        } catch (ConflictException $e) {
            // 【保険】時間帯が埋まっていた = カレンダーのキャッシュが古かった（空きに見えていた）。
            // その日のキャッシュを捨てて、次にカレンダーを見た人には新しい状態を出す（docs/04 の「キャッシュ方針」）。
            // トランザクションはロールバック済みなので、外で消す
            if ($e->errorCode === 'slot_taken') {
                $this->calendarFacts->forgetDay($slot->date);
            }
            throw $e;
        }
    }

    /**
     * その日付のロックを取る（トランザクションが終わるまで持ち、終わると自動で外れる）。
     *
     * 【臨時休業日との競合】次の順で起きると、休業日に予約が残ってしまう:
     *   1. 会員: 休業日でないことを確かめる
     *   2. 管理者: その日を休業日にし、その日の予約（まだ無い）をキャンセルして commit
     *   3. 会員: 予約を INSERT して commit → 休業日なのに予約がある
     * 予約と休業日の登録（手順7の CloseDay）の両方が、最初に同じ日付のロックを取ることで、
     * 同じ日付の処理を1つずつ順番に行わせる。休業日かどうかは、ロックを取った後に調べる。
     *
     * pg_advisory_xact_lock は、表の行ではなく「数字」に対してかけるロック。日付の文字列を数字（crc32）にして使う。
     * 違う日付どうしは待たせない。
     */
    private function lockDate(TimeSlot $slot): void
    {
        DB::statement('SELECT pg_advisory_xact_lock(?)', [crc32('reservation-date:'.$slot->date->toDateString())]);
    }

    /**
     * 定休日・臨時休業日なら 422（項目エラー date）。
     *
     * ClosedDays は Redis のキャッシュを使わず DB を見る（予約の可否は正確でなければならないため。docs/04）。
     */
    private function assertOpen(TimeSlot $slot): void
    {
        $reason = $this->closedDays->reasonFor($slot->date);

        if ($reason !== null) {
            throw ValidationException::withMessages([
                // 'regular_holiday' か 'holiday'（lang/ja/booking.php）
                'date' => __("booking.{$reason->value}"),
            ]);
        }
    }

    /**
     * 予約を INSERT する。
     *
     * 【B2・B3】先に「空いているか」を調べず、そのまま INSERT して、DB の制約違反を 409 に変える。
     * R1 は「重なる予約があるか調べる → 無ければ作る」だったので、2つのリクエストが同時に調べると、両方作られた。
     * DB の制約は同時に来ても必ず片方を止めるので、二重予約が起きない（docs/04 の「二重予約をどう防ぐか」）。
     *
     * | 制約                                         | SQLSTATE | 返すエラー                      |
     * |----------------------------------------------|----------|---------------------------------|
     * | reservations_no_overlap（時間帯の重なり）    | 23P01    | 409 slot_taken                  |
     * | reservations_user_date_confirmed_unique（1人1日1件） | 23505 | 409 already_booked_that_day |
     */
    private function insert(TimeSlot $slot, string $bookerName, ?User $user): Reservation
    {
        try {
            return Reservation::query()->create([
                'user_id' => $user?->id,
                'date' => $slot->date->toDateString(),
                'start_hour' => $slot->startHour,
                'end_hour' => $slot->endHour,
                'status' => ReservationStatus::Confirmed,
                'booker_name' => $bookerName,
                // 予約した時点の料金で計算して保存する（後で料金が変わっても変えない。docs/01 の R9。D8）
                'price' => Price::table()->priceFor($slot),
            ]);
        } catch (QueryException $e) {
            throw $this->toConflict($e);
        }
    }

    /**
     * DB の制約違反を、対応する 409 に変える。どちらでもなければ、元の例外をそのまま返す（500 になる）。
     * どちらの制約に当たったかは、エラーの種類（SQLSTATE）と、メッセージに入っている制約の名前で見分ける。
     */
    private function toConflict(QueryException $e): QueryException|ConflictException
    {
        $message = $e->getMessage();

        if ($e->getCode() === '23P01' && str_contains($message, 'reservations_no_overlap')) {
            return ConflictException::slotTaken();
        }

        if ($e->getCode() === '23505' && str_contains($message, 'reservations_user_date_confirmed_unique')) {
            return ConflictException::alreadyBookedThatDay();
        }

        return $e;
    }
}
