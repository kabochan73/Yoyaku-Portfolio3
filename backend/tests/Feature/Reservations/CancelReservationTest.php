<?php

declare(strict_types=1);

use App\Actions\Reservations\CancelReservation;
use App\Enums\CancellationReason;
use App\Enums\ReservationStatus;
use App\Events\ReservationCancelled;
use App\Exceptions\ConflictException;
use App\Models\Reservation;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

/*
 * CancelReservation（予約のキャンセル）のテスト。docs/06 の「キャンセル（B4）」。
 * 今を 2026-10-06（火）15:00 に固定する。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Tokyo'));
});

/** 会員としてキャンセルする */
function cancelAsMember(Reservation $reservation): Reservation
{
    return app(CancelReservation::class)->handle($reservation, CancellationReason::ByMember);
}

it('キャンセル済みにし、キャンセルした日時を入れる。行は消さない（C3）', function () {
    $reservation = Reservation::factory()->on('2026-10-07', 12, 14)->create();

    $cancelled = cancelAsMember($reservation);

    expect($cancelled->status)->toBe(ReservationStatus::Cancelled)
        ->and($cancelled->cancelled_at?->toDateTimeString())->toBe('2026-10-06 15:00:00')
        ->and($reservation->fresh()?->status)->toBe(ReservationStatus::Cancelled);
});

it('今日の、まだ始まっていない予約はキャンセルできる（キャンセル料なし。C4）', function () {
    $reservation = Reservation::factory()->on('2026-10-06', 16, 18)->create();

    expect(cancelAsMember($reservation)->status)->toBe(ReservationStatus::Cancelled);
});

it('ReservationCancelled を、理由つきで出す', function () {
    Event::fake([ReservationCancelled::class]);
    $reservation = Reservation::factory()->on('2026-10-07', 12, 14)->create();

    app(CancelReservation::class)->handle($reservation, CancellationReason::ByHoliday, '設備点検');

    Event::assertDispatched(
        ReservationCancelled::class,
        fn (ReservationCancelled $event): bool => $event->reservation->is($reservation)
            && $event->reason === CancellationReason::ByHoliday
            && $event->note === '設備点検',
    );
});

it('B4: キャンセルできない予約は 409 reservation_not_cancellable で、何も変えずイベントも出さない', function (string $date, int $start, int $end, bool $cancelled) {
    Event::fake([ReservationCancelled::class]);
    $factory = Reservation::factory()->on($date, $start, $end);
    $reservation = ($cancelled ? $factory->cancelled() : $factory)->create();
    $before = $reservation->fresh()?->toArray();

    expect(fn () => cancelAsMember($reservation))
        ->toThrow(fn (ConflictException $e) => expect($e->errorCode)->toBe('reservation_not_cancellable'));

    expect($reservation->fresh()?->toArray())->toBe($before);
    Event::assertNotDispatched(ReservationCancelled::class);
})->with([
    'キャンセル済み' => ['2026-10-07', 12, 14, true],
    '利用中（今 15:00、14〜16時）' => ['2026-10-06', 14, 16, false],
    '開始時刻ちょうど（今 15:00、15〜17時）' => ['2026-10-06', 15, 17, false],
    '終了済み（今日の 10〜12時）' => ['2026-10-06', 10, 12, false],
]);

it('行をロック（SELECT ... FOR UPDATE）して読み直してから調べる', function () {
    $reservation = Reservation::factory()->on('2026-10-07', 12, 14)->create();

    DB::flushQueryLog();
    DB::enableQueryLog();
    cancelAsMember($reservation);
    DB::disableQueryLog();

    expect(DB::getQueryLog()[0]['query'] ?? '')->toContain('for update');
});

it('呼んだ側が古い（まだ確定済みの）予約を持っていても、読み直した最新の状態で判定する', function () {
    $reservation = Reservation::factory()->on('2026-10-07', 12, 14)->create();
    // 別の誰かが先にキャンセルした（$reservation は古いまま）
    cancelAsMember(Reservation::query()->findOrFail($reservation->id));

    expect(fn () => cancelAsMember($reservation))->toThrow(ConflictException::class);
});
