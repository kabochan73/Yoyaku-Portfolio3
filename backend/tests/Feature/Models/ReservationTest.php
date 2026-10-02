<?php

declare(strict_types=1);

use App\Enums\ReservationPhase;
use App\Enums\ReservationStatus;
use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;

/*
 * Reservation モデルのテスト: 絞り込み（スコープ）・段階（phase）とキャンセルできるか・古い予約の削除・Factory。
 *
 * 「今日」に依存するので、時刻を固定してから確かめる（docs/06 の方針）。
 * 2026-10-06（火）の 15:00 を「今」とする。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Tokyo'));
});

describe('confirmed()', function () {
    it('キャンセル済みを除き、確定済みだけを返す', function () {
        $confirmed = Reservation::factory()->phone()->on('2026-10-07', 10, 12)->create();
        Reservation::factory()->phone()->on('2026-10-07', 10, 12)->cancelled()->create();

        expect(Reservation::query()->confirmed()->pluck('id')->all())->toBe([$confirmed->id]);
    });
});

describe('between()', function () {
    it('期間の両端の日を含み、その外は含まない', function () {
        // 期間は 10/5（月）〜10/11（日）の1週間
        $dates = ['2026-10-04', '2026-10-05', '2026-10-08', '2026-10-11', '2026-10-12'];
        foreach ($dates as $date) {
            Reservation::factory()->phone()->on($date, 10, 12)->create();
        }

        $found = Reservation::query()
            ->between(CarbonImmutable::parse('2026-10-05'), CarbonImmutable::parse('2026-10-11'))
            ->orderBy('date')
            ->get()
            ->map(fn (Reservation $r): string => $r->date->toDateString())
            ->all();

        expect($found)->toBe(['2026-10-05', '2026-10-08', '2026-10-11']);
    });
});

describe('upcoming()', function () {
    it('今日以降の確定済みの予約を、日付・開始時刻の順に返す', function () {
        $user = User::factory()->create();

        // 作る順番をばらばらにして、並び順を確かめる
        $later = Reservation::factory()->for($user)->on('2026-10-08', 10, 12)->create();
        $todayStarted = Reservation::factory()->for($user)->on('2026-10-06', 10, 12)->create(); // 今日・開始済み（今は15時）
        $tomorrow = Reservation::factory()->for($user)->on('2026-10-07', 18, 20)->create();

        // 含まれないもの: 昨日の予約、キャンセル済みの予約
        Reservation::factory()->for($user)->on('2026-10-05', 10, 12)->create();
        Reservation::factory()->for($user)->on('2026-10-09', 10, 12)->cancelled()->create();

        expect($user->reservations()->upcoming()->pluck('id')->all())
            ->toBe([$todayStarted->id, $tomorrow->id, $later->id]);
    });

    it('同じ日の予約は開始時刻の順に並ぶ', function () {
        // 1人1日1件なので、同じ日に複数あるのは電話予約の場合。並び順の確認のために電話予約で作る
        $evening = Reservation::factory()->phone()->on('2026-10-07', 18, 20)->create();
        $morning = Reservation::factory()->phone()->on('2026-10-07', 10, 12)->create();

        expect(Reservation::query()->upcoming()->pluck('id')->all())->toBe([$morning->id, $evening->id]);
    });
});

describe('古い予約の削除（model:prune）', function () {
    it('予約日が3か月より前の予約だけが消える', function () {
        // 今日は 10/6。3か月前は 7/6
        $boundary = Reservation::factory()->phone()->on('2026-07-06', 10, 12)->create(); // ちょうど3か月前 → 残る
        $old = Reservation::factory()->phone()->on('2026-07-05', 10, 12)->create();      // その前日 → 消える
        $oldCancelled = Reservation::factory()->phone()->on('2026-06-01', 10, 12)->cancelled()->create(); // キャンセル済みでも古ければ消える
        $recent = Reservation::factory()->phone()->on('2026-10-01', 10, 12)->create();   // 最近 → 残る

        $this->artisan('model:prune', ['--model' => [Reservation::class]])->assertSuccessful();

        expect(Reservation::query()->pluck('id')->sort()->values()->all())
            ->toBe(collect([$boundary->id, $recent->id])->sort()->values()->all())
            ->and(Reservation::query()->whereKey([$old->id, $oldCancelled->id])->exists())->toBeFalse();
    });

    it('月末でも溢れずに3か月前を数える（5/31 の3か月前は 2/28）', function () {
        $this->travelTo(CarbonImmutable::parse('2027-05-31 15:00', 'Asia/Tokyo'));

        $boundary = Reservation::factory()->phone()->on('2027-02-28', 10, 12)->create(); // 残る
        Reservation::factory()->phone()->on('2027-02-27', 10, 12)->create();             // 消える

        $this->artisan('model:prune', ['--model' => [Reservation::class]])->assertSuccessful();

        expect(Reservation::query()->pluck('id')->all())->toBe([$boundary->id]);
    });
});

describe('Factory', function () {
    it('既定では、会員の確定済み予約が作られ、予約者名と金額が入る', function () {
        $reservation = Reservation::factory()->create();

        expect($reservation->status)->toBe(ReservationStatus::Confirmed)
            ->and($reservation->user)->not->toBeNull()
            ->and($reservation->booker_name)->toBe($reservation->user?->name)
            ->and($reservation->price)->toBe(8000); // 4,000円 × 2時間
    });

    it('cancelled() はキャンセル日時も入れる（DB の CHECK 制約を満たす）', function () {
        $reservation = Reservation::factory()->cancelled()->create();

        expect($reservation->status)->toBe(ReservationStatus::Cancelled)
            ->and($reservation->cancelled_at)->not->toBeNull();
    });

    it('phone() は会員と紐づかない', function () {
        $reservation = Reservation::factory()->phone()->create();

        expect($reservation->user_id)->toBeNull()
            ->and($reservation->booker_name)->toStartWith('電話 ');
    });

    it('User の admin() は管理者を作る', function () {
        expect(User::factory()->admin()->create()->isAdmin())->toBeTrue()
            ->and(User::factory()->create()->isAdmin())->toBeFalse();
    });
});

describe('phase()・isCancellable()（6-1）', function () {
    /** 12〜14時の予約を、$time の時点で見たときの段階 */
    function phaseAt(string $time, ?Reservation $reservation = null): ReservationPhase
    {
        $reservation ??= Reservation::factory()->phone()->on('2026-10-06', 12, 14)->make();

        return $reservation->phase(CarbonImmutable::parse("2026-10-06 {$time}", 'Asia/Tokyo'));
    }

    it('開始前 → 利用中 → 終了。開始時刻ちょうどは利用中、終了時刻ちょうどは終了', function () {
        expect(phaseAt('11:59'))->toBe(ReservationPhase::BeforeStart)
            ->and(phaseAt('12:00'))->toBe(ReservationPhase::InUse)
            ->and(phaseAt('13:59'))->toBe(ReservationPhase::InUse)
            ->and(phaseAt('14:00'))->toBe(ReservationPhase::Finished);
    });

    it('前の日・次の日の予約も、日付まで含めて比べる', function () {
        $tomorrow = Reservation::factory()->phone()->on('2026-10-07', 10, 12)->make();
        $yesterday = Reservation::factory()->phone()->on('2026-10-05', 20, 22)->make();

        expect(phaseAt('23:00', $tomorrow))->toBe(ReservationPhase::BeforeStart)
            ->and(phaseAt('09:00', $yesterday))->toBe(ReservationPhase::Finished);
    });

    it('キャンセルできるのは、確定済みかつ開始前だけ（C2・B4）', function () {
        $reservation = Reservation::factory()->phone()->on('2026-10-06', 12, 14)->make();
        $cancelled = Reservation::factory()->phone()->on('2026-10-06', 18, 20)->cancelled()->make();

        expect($reservation->isCancellable(CarbonImmutable::parse('2026-10-06 11:59', 'Asia/Tokyo')))->toBeTrue()
            ->and($reservation->isCancellable(CarbonImmutable::parse('2026-10-06 12:00', 'Asia/Tokyo')))->toBeFalse()
            ->and($cancelled->isCancellable(CarbonImmutable::parse('2026-10-06 11:00', 'Asia/Tokyo')))->toBeFalse();
    });
});
