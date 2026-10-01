<?php

declare(strict_types=1);

use App\Enums\PriceType;
use App\Models\Price;
use App\Models\RegularHoliday;
use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoDataSeeder;
use Database\Seeders\InitialDataSeeder;
use Illuminate\Support\Facades\Hash;

/*
 * シーダーのテスト（docs/02 の「シーダー」）。
 * 2026-10-06（火）15:00 を「今」とする。
 */

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-06 15:00', 'Asia/Tokyo'));

    // 管理者の設定（テストの中だけの値。.env の値に頼らない）
    config([
        'facility.admin.email' => 'admin@example.com',
        'facility.admin.password' => 'admin-password',
    ]);
});

describe('InitialDataSeeder', function () {
    it('管理者・料金・定休日を入れる', function () {
        $this->seed(InitialDataSeeder::class);

        $admin = User::query()->where('email', 'admin@example.com')->firstOrFail();
        expect($admin->isAdmin())->toBeTrue()
            // パスワードはハッシュ化されて保存される（平文ではない）
            ->and(Hash::check('admin-password', $admin->password))->toBeTrue();

        expect(Price::query()->where('type', PriceType::Weekday)->value('amount_per_hour'))->toBe(4000)
            ->and(Price::query()->where('type', PriceType::Weekend)->value('amount_per_hour'))->toBe(5000)
            // 定休日は月曜（1）
            ->and(RegularHoliday::query()->pluck('day_of_week')->all())->toBe([1]);
    });

    it('2回流しても行は増えない', function () {
        $this->seed(InitialDataSeeder::class);
        $this->seed(InitialDataSeeder::class);

        expect(User::query()->count())->toBe(1)
            ->and(Price::query()->count())->toBe(2)
            ->and(RegularHoliday::query()->count())->toBe(1);
    });

    it('2回目は、管理者が変えた料金・定休日・パスワードを初期値に戻さない', function () {
        $this->seed(InitialDataSeeder::class);

        // 管理者が画面で設定を変えた想定
        Price::query()->where('type', PriceType::Weekday)->update(['amount_per_hour' => 4500]);
        RegularHoliday::query()->delete(); // 定休日なしにした
        User::query()->where('email', 'admin@example.com')->update(['password' => Hash::make('changed')]);

        $this->seed(InitialDataSeeder::class);

        expect(Price::query()->where('type', PriceType::Weekday)->value('amount_per_hour'))->toBe(4500)
            ->and(RegularHoliday::query()->count())->toBe(0)
            ->and(Hash::check('changed', User::query()->firstOrFail()->password))->toBeTrue();
    });

    it('管理者のメール・パスワードが未設定なら止まる', function (string $key) {
        config([$key => null]);

        expect(fn () => $this->seed(InitialDataSeeder::class))
            ->toThrow(RuntimeException::class, 'ADMIN_EMAIL と ADMIN_PASSWORD を設定してください');
    })->with(['facility.admin.email', 'facility.admin.password']);
});

describe('DemoDataSeeder', function () {
    beforeEach(function () {
        $this->seed(InitialDataSeeder::class);
        $this->seed(DemoDataSeeder::class);
    });

    it('デモ会員3人と、予約を入れる', function () {
        expect(User::query()->where('email', 'like', 'demo%@example.com')->count())->toBe(3)
            ->and(Reservation::query()->count())->toBeGreaterThan(0);
    });

    it('予約はすべてルールを満たす', function () {
        $tomorrow = today()->addDay()->toDateString();
        $lastDay = today()->addDays(14)->toDateString();

        foreach (Reservation::all() as $reservation) {
            $hours = $reservation->end_hour - $reservation->start_hour;
            $unitPrice = $reservation->date->isWeekend() ? 5000 : 4000;

            expect($reservation->start_hour)->toBeGreaterThanOrEqual(10)   // 営業時間内
                ->and($reservation->end_hour)->toBeLessThanOrEqual(22)
                ->and($hours)->toBeGreaterThanOrEqual(2)->toBeLessThanOrEqual(4) // 2〜4時間
                ->and($reservation->date->dayOfWeek)->not->toBe(CarbonImmutable::MONDAY) // 定休日を避ける
                ->and($reservation->date->toDateString())->toBeGreaterThanOrEqual($tomorrow) // 明日から
                ->and($reservation->date->toDateString())->toBeLessThanOrEqual($lastDay)     // 14日分
                ->and($reservation->price)->toBe($unitPrice * $hours); // 平日・土日の単価 × 時間
        }
        // 重なりと「1人1日1件」は DB の制約が守っている（違反していればシードの時点で失敗する）
    });

    it('2回流しても増えない（2回目は何もしない）', function () {
        $count = Reservation::query()->count();

        $this->seed(DemoDataSeeder::class);

        expect(Reservation::query()->count())->toBe($count)
            ->and(User::query()->where('email', 'like', 'demo%@example.com')->count())->toBe(3);
    });
});

it('DatabaseSeeder はローカル以外ではデモデータを入れない', function () {
    // テストの APP_ENV は testing（phpunit.xml）
    $this->seed(DatabaseSeeder::class);

    expect(User::query()->count())->toBe(1) // 管理者だけ
        ->and(Reservation::query()->count())->toBe(0);
});
