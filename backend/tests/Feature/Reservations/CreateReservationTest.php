<?php

declare(strict_types=1);

use App\Actions\Reservations\CreateReservation;
use App\Booking\TimeSlot;
use App\Enums\PriceType;
use App\Enums\ReservationStatus;
use App\Events\ReservationCreated;
use App\Exceptions\ConflictException;
use App\Models\Holiday;
use App\Models\Price;
use App\Models\RegularHoliday;
use App\Models\Reservation;
use App\Models\User;
use App\Queries\CalendarFacts;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;

/*
 * CreateReservation（予約の作成）のテスト。docs/06 の「予約作成」「二重予約」「1人1日1件」など。
 *
 * 今を 2026-10-06（火）15:00 に固定する。予約できる最終日は 2026-11-06（金）。
 * 月曜が定休日。料金は平日 4,000円/時・土日 5,000円/時。
 * 2026-10-07 は水曜（平日）、2026-10-10 は土曜。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Tokyo'));
    RegularHoliday::query()->create(['day_of_week' => 1]);
    Price::query()->create(['type' => PriceType::Weekday, 'amount_per_hour' => 4000]);
    Price::query()->create(['type' => PriceType::Weekend, 'amount_per_hour' => 5000]);
    $this->user = User::factory()->create(['name' => '山田太郎']);
});

/** 会員の予約を作る */
function book(User $user, string $date, int $startHour, int $endHour): Reservation
{
    return app(CreateReservation::class)->forMember($user, TimeSlot::on($date, $startHour, $endHour));
}

/**
 * 予約が 422 になり、$field に項目エラーが付くことを確かめる。
 */
function expectRejected(callable $book, string $field): void
{
    try {
        $book();
    } catch (ValidationException $e) {
        expect($e->errors())->toHaveKey($field);

        return;
    }

    test()->fail("422（{$field}）になるはずが、予約できてしまった");
}

describe('成功', function () {
    it('予約を確定済みで作り、予約者名は会員の名前、料金は平日の単価 × 時間数', function () {
        $reservation = book($this->user, '2026-10-07', 12, 14);

        expect($reservation->user_id)->toBe($this->user->id)
            ->and($reservation->status)->toBe(ReservationStatus::Confirmed)
            ->and($reservation->booker_name)->toBe('山田太郎')
            ->and($reservation->price)->toBe(8000);
    });

    it('土日は土日の単価で計算する', function () {
        expect(book($this->user, '2026-10-10', 12, 14)->price)->toBe(10000);
    });

    it('ReservationCreated を出す', function () {
        Event::fake([ReservationCreated::class]);

        $reservation = book($this->user, '2026-10-07', 12, 14);

        Event::assertDispatched(
            ReservationCreated::class,
            fn (ReservationCreated $event): bool => $event->reservation->is($reservation),
        );
    });

    it('B1: 日本時間 08:00（UTC ではまだ前日）でも、当日の枠を予約できる', function () {
        $this->travelTo(CarbonImmutable::parse('2026-10-07 08:00', 'Asia/Tokyo'));

        expect(book($this->user, '2026-10-07', 10, 12)->date->toDateString())->toBe('2026-10-07');
    });
});

describe('ルール違反は 422（境界値）', function () {
    it('長さ: 2時間・4時間は予約でき、1時間・5時間は end_hour のエラー', function () {
        expect(book($this->user, '2026-10-07', 10, 12))->toBeInstanceOf(Reservation::class);
        expect(book(User::factory()->create(), '2026-10-07', 12, 16))->toBeInstanceOf(Reservation::class);

        expectRejected(fn () => book($this->user, '2026-10-08', 10, 11), 'end_hour');
        expectRejected(fn () => book($this->user, '2026-10-08', 10, 15), 'end_hour');
    });

    it('営業時間: 20〜22時は予約でき、9時開始・21時開始（22時を越える）は start_hour のエラー', function () {
        expect(book($this->user, '2026-10-07', 20, 22))->toBeInstanceOf(Reservation::class);

        expectRejected(fn () => book($this->user, '2026-10-08', 9, 11), 'start_hour');
        expectRejected(fn () => book($this->user, '2026-10-08', 21, 23), 'start_hour');
    });

    it('B10: 今日の開始時刻を過ぎた枠・ちょうどの枠は予約できない', function () {
        // 今は 15:00
        expectRejected(fn () => book($this->user, '2026-10-06', 14, 16), 'start_hour');
        expectRejected(fn () => book($this->user, '2026-10-06', 15, 17), 'start_hour');
        expect(book($this->user, '2026-10-06', 16, 18))->toBeInstanceOf(Reservation::class);
    });

    it('過去の日は date のエラー', function () {
        expectRejected(fn () => book($this->user, '2026-10-05', 12, 14), 'date');
    });

    it('B13: 1か月後の同日（11/6）は予約でき、翌日（11/7）は date のエラー', function () {
        expect(book($this->user, '2026-11-06', 12, 14))->toBeInstanceOf(Reservation::class);

        expectRejected(fn () => book($this->user, '2026-11-07', 12, 14), 'date');
    });

    it('B13: 1/31 から見ると、2/28 は予約でき、3/1 は date のエラー（月末で溢れない）', function () {
        $this->travelTo(CarbonImmutable::parse('2027-01-31 10:00', 'Asia/Tokyo'));

        // 2027-02-28 は日曜、2027-03-01 は月曜（定休日）なので、定休日ではなく期間外のエラーであることも見る
        expect(book($this->user, '2027-02-28', 12, 14))->toBeInstanceOf(Reservation::class);

        try {
            book($this->user, '2027-03-01', 12, 14);
            test()->fail('予約できてしまった');
        } catch (ValidationException $e) {
            expect($e->errors()['date'][0])->toBe('2月28日より先は予約できません。');
        }
    });

    it('定休日・臨時休業日は date のエラー', function () {
        Holiday::query()->create(['date' => '2026-10-08']);

        expectRejected(fn () => book($this->user, '2026-10-12', 12, 14), 'date'); // 月曜
        expectRejected(fn () => book($this->user, '2026-10-08', 12, 14), 'date');
    });

    it('予約時はキャッシュを使わない: キャッシュに「休業日ではない」が残っていても、DB に休業日があれば 422', function () {
        // カレンダーを見て、10/8 の事実（休業日ではない）をキャッシュに入れる
        app(CalendarFacts::class)->days(CarbonImmutable::parse('2026-10-08'), CarbonImmutable::parse('2026-10-08'));
        // キャッシュを消さずに、DB にだけ休業日を入れる
        Holiday::query()->create(['date' => '2026-10-08']);

        expectRejected(fn () => book($this->user, '2026-10-08', 12, 14), 'date');
    });
});

describe('今のデータとぶつかると 409', function () {
    it('B2: 重なる時間帯は slot_taken', function () {
        Reservation::factory()->on('2026-10-07', 13, 15)->create();

        expect(fn () => book($this->user, '2026-10-07', 12, 14))
            ->toThrow(fn (ConflictException $e) => expect($e->errorCode)->toBe('slot_taken'));
    });

    it('B2: 終わりと始まりが接するだけなら重ならない（12〜14時と14〜16時）', function () {
        Reservation::factory()->on('2026-10-07', 12, 14)->create();

        expect(book($this->user, '2026-10-07', 14, 16))->toBeInstanceOf(Reservation::class);
    });

    it('slot_taken のときは、その日のカレンダーのキャッシュを消す（保険）', function () {
        $facts = app(CalendarFacts::class);
        $facts->days(CarbonImmutable::parse('2026-10-07'), CarbonImmutable::parse('2026-10-08'));
        Reservation::factory()->on('2026-10-07', 12, 14)->create();

        try {
            book($this->user, '2026-10-07', 12, 14);
        } catch (ConflictException) {
        }

        expect(Cache::has('calendar:day:2026-10-07'))->toBeFalse()
            // 他の日は消さない
            ->and(Cache::has('calendar:day:2026-10-08'))->toBeTrue();
    });

    it('B3: 同じ日に自分の予約があれば already_booked_that_day', function () {
        book($this->user, '2026-10-07', 10, 12);

        expect(fn () => book($this->user, '2026-10-07', 18, 20))
            ->toThrow(fn (ConflictException $e) => expect($e->errorCode)->toBe('already_booked_that_day'));
    });

    it('B3: キャンセル済みの予約しか無ければ、同じ日に予約できる', function () {
        Reservation::factory()->for($this->user)->on('2026-10-07', 10, 12)->cancelled()->create();

        expect(book($this->user, '2026-10-07', 18, 20))->toBeInstanceOf(Reservation::class);
    });

    it('409 のときは予約を作らず、ReservationCreated も出さない', function () {
        Reservation::factory()->on('2026-10-07', 12, 14)->create();
        Event::fake([ReservationCreated::class]);

        try {
            book($this->user, '2026-10-07', 12, 14);
        } catch (ConflictException) {
        }

        expect(Reservation::query()->where('user_id', $this->user->id)->exists())->toBeFalse();
        Event::assertNotDispatched(ReservationCreated::class);
    });
});

it('日付ごとのロック（pg_advisory_xact_lock）を取ってから予約する', function () {
    DB::flushQueryLog();
    DB::enableQueryLog();
    book($this->user, '2026-10-07', 12, 14);
    DB::disableQueryLog();

    $queries = array_column(DB::getQueryLog(), 'query');

    expect($queries[0] ?? '')->toContain('pg_advisory_xact_lock');
});
