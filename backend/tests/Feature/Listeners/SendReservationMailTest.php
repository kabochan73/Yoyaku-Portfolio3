<?php

declare(strict_types=1);

use App\Actions\Reservations\CancelReservation;
use App\Enums\CancellationReason;
use App\Enums\PriceType;
use App\Events\ReservationCancelled;
use App\Events\ReservationCreated;
use App\Listeners\SendReservationCancelledMail;
use App\Listeners\SendReservationConfirmedMail;
use App\Mail\ReservationCancelledMail;
use App\Mail\ReservationConfirmedMail;
use App\Models\Price;
use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Events\CallQueuedListener;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

/*
 * 予約・キャンセルのメールを送る Listener のテスト（docs/06 の「メール（B8）」）。
 * テストではキューがその場で動く（phpunit.xml の QUEUE_CONNECTION=sync）ので、Mail::fake() で送られたかを見る。
 *
 * 今を 2026-10-06（火）15:00 に固定する。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Tokyo'));
    Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => 4000]);
    Price::query()->create(['type' => PriceType::Weekend, 'amount_per_hour' => 5000]);
    $this->user = User::factory()->create(['email' => 'taro@example.com']);
    Mail::fake();
});

it('会員が予約したら、その会員に完了メールを送る', function () {
    $this->actingAs($this->user)
        ->postJson('/api/reservations', ['date' => '2026-10-07', 'start_hour' => 12, 'end_hour' => 14])
        ->assertCreated();

    Mail::assertSent(
        ReservationConfirmedMail::class,
        fn (ReservationConfirmedMail $mail): bool => $mail->hasTo('taro@example.com'),
    );
});

it('会員がキャンセルしたら、「会員によるキャンセル」の文面で送る', function () {
    $reservation = Reservation::factory()->for($this->user)->on('2026-10-07', 12, 14)->create();

    $this->actingAs($this->user)->postJson("/api/reservations/{$reservation->id}/cancel")->assertOk();

    Mail::assertSent(
        ReservationCancelledMail::class,
        fn (ReservationCancelledMail $mail): bool => $mail->hasTo('taro@example.com')
            && $mail->reason === CancellationReason::ByMember,
    );
});

it('電話予約（会員なし）には、予約・キャンセルのどちらのメールも送らない', function () {
    $phone = Reservation::factory()->phone()->on('2026-10-07', 12, 14)->create();

    ReservationCreated::dispatch($phone);
    app(CancelReservation::class)->handle($phone, CancellationReason::ByAdmin);

    Mail::assertNothingSent();
});

it('B8: ロールバックしたら、メールは1通も送られない', function () {
    $reservation = Reservation::factory()->for($this->user)->on('2026-10-07', 12, 14)->create();

    try {
        DB::transaction(function () use ($reservation) {
            ReservationCreated::dispatch($reservation);
            ReservationCancelled::dispatch($reservation, CancellationReason::ByMember);
            throw new RuntimeException('途中で失敗した');
        });
    } catch (RuntimeException) {
    }

    Mail::assertNothingSent();
});

it('メールはキューに積んで送る（API の返事を待たせない）', function () {
    Queue::fake();

    $this->actingAs($this->user)
        ->postJson('/api/reservations', ['date' => '2026-10-07', 'start_hour' => 12, 'end_hour' => 14])
        ->assertCreated();

    Queue::assertPushed(
        CallQueuedListener::class,
        fn (CallQueuedListener $job): bool => $job->class === SendReservationConfirmedMail::class,
    );
    // キューに積んだだけで、まだ送っていない
    Mail::assertNothingSent();
    // キャンセルのメールの Listener は、キャンセルのときだけ動く
    Queue::assertNotPushed(
        CallQueuedListener::class,
        fn (CallQueuedListener $job): bool => $job->class === SendReservationCancelledMail::class,
    );
});
