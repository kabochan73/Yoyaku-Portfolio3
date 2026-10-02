<?php

declare(strict_types=1);

use App\Enums\CancellationReason;
use App\Enums\ReservationStatus;
use App\Mail\ReservationCancelledMail;
use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;

/*
 * POST /api/admin/reservations/{reservation}/cancel（管理者のキャンセル）のテスト。docs/06 の「キャンセル（B4）」。
 * 今を 2026-10-06（火）15:00 に固定する。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Tokyo'));
    $this->admin = User::factory()->admin()->create();
    Mail::fake();
});

it('会員の予約をキャンセルでき、会員には「管理者によるキャンセル」のメールが届く', function () {
    $member = User::factory()->create(['email' => 'taro@example.com']);
    $reservation = Reservation::factory()->for($member)->on('2026-10-07', 12, 14)->create();

    $this->actingAs($this->admin)
        ->postJson("/api/admin/reservations/{$reservation->id}/cancel")
        ->assertOk()
        ->assertJsonPath('data.status', 'cancelled')
        ->assertJsonPath('data.user_id', $member->id);

    expect($reservation->fresh()?->status)->toBe(ReservationStatus::Cancelled);
    Mail::assertSent(
        ReservationCancelledMail::class,
        fn (ReservationCancelledMail $mail): bool => $mail->hasTo('taro@example.com')
            && $mail->reason === CancellationReason::ByAdmin,
    );
});

it('電話予約もキャンセルでき、メールは送らない', function () {
    $phone = Reservation::factory()->phone()->on('2026-10-07', 12, 14)->create();

    $this->actingAs($this->admin)
        ->postJson("/api/admin/reservations/{$phone->id}/cancel")
        ->assertOk()
        ->assertJsonPath('data.is_phone', true);

    Mail::assertNothingSent();
});

it('キャンセル済み・開始済みの予約は 409 reservation_not_cancellable', function (bool $cancelled, string $date, int $start, int $end) {
    $factory = Reservation::factory()->on($date, $start, $end);
    $reservation = ($cancelled ? $factory->cancelled() : $factory)->create();

    $this->actingAs($this->admin)
        ->postJson("/api/admin/reservations/{$reservation->id}/cancel")
        ->assertConflict()
        ->assertJson(['code' => 'reservation_not_cancellable']);
})->with([
    'キャンセル済み' => [true, '2026-10-07', 12, 14],
    '開始済み（今 15:00、14〜16時）' => [false, '2026-10-06', 14, 16],
]);

it('会員は管理者用のキャンセルを使えない（自分の予約でも 403）', function () {
    $member = User::factory()->create();
    $reservation = Reservation::factory()->for($member)->on('2026-10-07', 12, 14)->create();

    $this->actingAs($member)
        ->postJson("/api/admin/reservations/{$reservation->id}/cancel")
        ->assertForbidden();

    expect($reservation->fresh()?->status)->toBe(ReservationStatus::Confirmed);
});
