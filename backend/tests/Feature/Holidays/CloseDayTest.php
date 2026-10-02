<?php

declare(strict_types=1);

use App\Actions\Holidays\CloseDay;
use App\Actions\Holidays\ReopenDay;
use App\Actions\Reservations\CreateReservation;
use App\Booking\TimeSlot;
use App\Enums\CancellationReason;
use App\Enums\PriceType;
use App\Enums\ReservationStatus;
use App\Events\HolidayChanged;
use App\Exceptions\ConflictException;
use App\Mail\ReservationCancelledMail;
use App\Models\Holiday;
use App\Models\Price;
use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/*
 * CloseDay・ReopenDay（臨時休業日の登録・解除）のテスト。docs/06 の「臨時休業（B7）」「当日の休業登録（B14）」。
 * 今を 2026-10-06（火）14:00 に固定する。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 14:00', 'Asia/Tokyo'));
    Mail::fake();
});

/** 休業日を登録する */
function closeDay(string $date, bool $cancelReservations = false, ?string $reason = '設備点検'): Holiday
{
    return app(CloseDay::class)->handle(CarbonImmutable::parse($date), $reason, $cancelReservations);
}

it('予約が無い日は、確認なしで休業日にでき、HolidayChanged を出す', function () {
    Event::fake([HolidayChanged::class]);

    $holiday = closeDay('2026-10-08');

    expect($holiday->date->toDateString())->toBe('2026-10-08')
        ->and($holiday->reason)->toBe('設備点検');
    Event::assertDispatched(HolidayChanged::class, fn (HolidayChanged $event): bool => $event->date->toDateString() === '2026-10-08');
});

it('予約がある日に確認なしで登録すると、409 と件数を返し、何も変えない', function () {
    Reservation::factory()->on('2026-10-08', 10, 12)->create();
    Reservation::factory()->on('2026-10-08', 18, 20)->create();

    try {
        closeDay('2026-10-08');
        test()->fail('409 になるはずが、登録できてしまった');
    } catch (ConflictException $e) {
        expect($e->errorCode)->toBe('holiday_has_reservations')
            ->and($e->extra)->toBe(['reservation_count' => 2])
            ->and($e->getMessage())->toBe('この日には2件の予約があります。すべてキャンセルして休業日にしますか？');
    }

    expect(Holiday::query()->exists())->toBeFalse()
        ->and(Reservation::query()->confirmed()->count())->toBe(2);
    Mail::assertNothingSent();
});

it('確認したら、その日の予約を全部キャンセルして休業日にし、会員に施設都合のメールを送る（理由入り）', function () {
    $member = User::factory()->create(['email' => 'taro@example.com']);
    $memberReservation = Reservation::factory()->for($member)->on('2026-10-08', 10, 12)->create();
    $phone = Reservation::factory()->phone()->on('2026-10-08', 18, 20)->create();
    // 別の日の予約は関係ない
    $otherDay = Reservation::factory()->on('2026-10-09', 10, 12)->create();

    closeDay('2026-10-08', cancelReservations: true);

    expect(Holiday::query()->whereDate('date', '2026-10-08')->exists())->toBeTrue()
        ->and($memberReservation->fresh()?->status)->toBe(ReservationStatus::Cancelled)
        ->and($phone->fresh()?->status)->toBe(ReservationStatus::Cancelled)
        ->and($otherDay->fresh()?->status)->toBe(ReservationStatus::Confirmed);

    // 電話予約にはメールを送らないので、会員の1通だけ
    Mail::assertSentCount(1);
    Mail::assertSent(
        ReservationCancelledMail::class,
        fn (ReservationCancelledMail $mail): bool => $mail->hasTo('taro@example.com')
            && $mail->reason === CancellationReason::ByHoliday
            && $mail->note === '設備点検',
    );
});

it('B14: 当日の休業登録では、開始済みの予約は残し、開始前の予約だけをキャンセルする（確認の件数も1件）', function () {
    // 今は 14:00
    $started = Reservation::factory()->on('2026-10-06', 10, 12)->create();
    $upcoming = Reservation::factory()->on('2026-10-06', 16, 18)->create();

    try {
        closeDay('2026-10-06');
    } catch (ConflictException $e) {
        expect($e->extra)->toBe(['reservation_count' => 1]);
    }

    closeDay('2026-10-06', cancelReservations: true);

    expect($started->fresh()?->status)->toBe(ReservationStatus::Confirmed)
        ->and($upcoming->fresh()?->status)->toBe(ReservationStatus::Cancelled);
});

it('B7: 途中で失敗したら、予約も休業日も元のままで、メールは1通も送られない', function () {
    $member = User::factory()->create();
    $reservation = Reservation::factory()->for($member)->on('2026-10-08', 10, 12)->create();
    // 休業日が登録された後（最後の HolidayChanged の時点）で失敗させる
    Event::listen(HolidayChanged::class, fn () => throw new RuntimeException('途中で失敗した'));

    expect(fn () => closeDay('2026-10-08', cancelReservations: true))->toThrow(RuntimeException::class);

    expect(Holiday::query()->exists())->toBeFalse()
        ->and($reservation->fresh()?->status)->toBe(ReservationStatus::Confirmed);
    Mail::assertNothingSent();
});

it('同じ日をもう一度登録すると 409 holiday_already_exists', function () {
    closeDay('2026-10-08');

    expect(fn () => closeDay('2026-10-08'))
        ->toThrow(fn (ConflictException $e) => expect($e->errorCode)->toBe('holiday_already_exists'));
});

it('休業日にした日は、予約できなくなる（422）', function () {
    Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => 4000]);
    Price::query()->create(['type' => PriceType::Weekend, 'amount_per_hour' => 5000]);
    closeDay('2026-10-08');

    expect(fn () => app(CreateReservation::class)->forMember(User::factory()->create(), TimeSlot::on('2026-10-08', 12, 14)))
        ->toThrow(ValidationException::class);
});

it('予約の作成と同じ日付のロック（pg_advisory_xact_lock）を取る', function () {
    DB::flushQueryLog();
    DB::enableQueryLog();
    closeDay('2026-10-08');
    DB::disableQueryLog();

    $lock = DB::getQueryLog()[0] ?? null;
    expect($lock['query'] ?? '')->toContain('pg_advisory_xact_lock')
        // 予約の作成（Reservation::lockDate）と同じ数字のロック
        ->and($lock['bindings'] ?? [])->toBe([crc32('reservation-date:2026-10-08')]);
});

it('ReopenDay: 休業日を消し、HolidayChanged を出す。キャンセルした予約は元に戻らない', function () {
    Reservation::factory()->on('2026-10-08', 10, 12)->create();
    $holiday = closeDay('2026-10-08', cancelReservations: true);
    Event::fake([HolidayChanged::class]);

    app(ReopenDay::class)->handle($holiday);

    expect(Holiday::query()->exists())->toBeFalse()
        ->and(Reservation::query()->confirmed()->exists())->toBeFalse();
    Event::assertDispatched(HolidayChanged::class);
});
