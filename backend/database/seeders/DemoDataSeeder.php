<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Booking\TimeSlot;
use App\Models\Holiday;
use App\Models\Price;
use App\Models\RegularHoliday;
use App\Models\Reservation;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * 画面を開いたときにカレンダーが空っぽにならないよう、見本のデータを入れる（docs/02 の「シーダー」）。
 *
 * - デモ会員3人（パスワードは全員 "password"）
 * - 明日から14日分の予約（会員の予約と電話予約）
 *
 * ローカルでは php artisan db:seed で自動的に入る（DatabaseSeeder）。
 * 本番では自動では入らない。入れるときは php artisan db:seed --class=DemoDataSeeder と明示する
 * （本番にデモデータを入れるかは手順9のデプロイのときに決める）。
 *
 * 【本番でも動くように Factory を使わない】
 * Factory は fake()（Faker）を使うが、Faker は開発用のパッケージなので本番には入っていない
 * （composer install --no-dev）。本番で流せるよう、ここでは決まった値で直接作る。
 *
 * 【ルールに合うデータだけを作る】
 * 営業時間内（10〜22時）・2〜4時間・定休日と臨時休業日を避ける・会員は1日1件・時間帯が重ならない。
 * 日付や時間帯は乱数ではなく決まった並びで作るので、何度作っても同じ形になる。
 */
final class DemoDataSeeder extends Seeder
{
    /** 予約を作る日数（明日から数える） */
    private const DAYS = 14;

    /** デモ会員（名前は20文字以内。users.name の長さ） */
    private const MEMBERS = [
        ['name' => '佐藤 花子', 'email' => 'demo1@example.com'],
        ['name' => '鈴木 一郎', 'email' => 'demo2@example.com'],
        ['name' => '高橋 美咲', 'email' => 'demo3@example.com'],
    ];

    /**
     * 1日ごとに使う時間帯の組み合わせ（[開始, 終了] の時）。日によって順番に使い回す。
     * 会員の予約と電話予約が重ならないよう、各行の2つは離してある。
     *
     * @var list<array{member: array{int, int}, phone: array{int, int}}>
     */
    private const DAILY_SLOTS = [
        ['member' => [10, 12], 'phone' => [18, 20]],
        ['member' => [19, 22], 'phone' => [13, 15]],
        ['member' => [14, 18], 'phone' => [10, 12]],
        ['member' => [16, 18], 'phone' => [20, 22]],
    ];

    public function run(): void
    {
        // すでにデモ会員がいれば何もしない（2回流して予約が重なり、排他制約で失敗するのを防ぐ）
        if (User::query()->where('email', self::MEMBERS[0]['email'])->exists()) {
            return;
        }

        DB::transaction(function (): void {
            $members = array_map(
                fn (array $member): User => User::query()->create([...$member, 'password' => 'password']),
                self::MEMBERS,
            );

            $this->seedReservations($members);
        });
    }

    /**
     * @param  list<User>  $members
     */
    private function seedReservations(array $members): void
    {
        // 料金表（InitialDataSeeder で入る）。金額は予約を作るときと同じ方法で計算する
        $prices = Price::table();
        $closedWeekdays = RegularHoliday::query()->pluck('day_of_week')->all();
        $holidayDates = Holiday::query()->pluck('date')
            ->map(fn (CarbonImmutable $date): string => $date->toDateString())
            ->all();

        // 今日の予約は作らない（今の時刻より前の枠を作ってしまわないように。B10）
        for ($offset = 1; $offset <= self::DAYS; $offset++) {
            $date = today()->toImmutable()->addDays($offset);

            // 定休日・臨時休業日には予約を入れない
            if (in_array($date->dayOfWeek, $closedWeekdays, true) || in_array($date->toDateString(), $holidayDates, true)) {
                continue;
            }

            $slots = self::DAILY_SLOTS[$offset % count(self::DAILY_SLOTS)];

            // 会員の予約。会員を日ごとに順番に割り当てる（1人1日1件を守る）
            $member = $members[$offset % count($members)];
            [$start, $end] = $slots['member'];
            Reservation::query()->create([
                'user_id' => $member->id,
                'date' => $date->toDateString(),
                'start_hour' => $start,
                'end_hour' => $end,
                'booker_name' => $member->name,
                'price' => $prices->priceFor(new TimeSlot($date, $start, $end)),
            ]);

            // 電話予約（管理者の代理登録）。2日に1件
            if ($offset % 2 === 0) {
                [$start, $end] = $slots['phone'];
                Reservation::query()->create([
                    'user_id' => null,
                    'date' => $date->toDateString(),
                    'start_hour' => $start,
                    'end_hour' => $end,
                    'booker_name' => '電話 田中',
                    'price' => $prices->priceFor(new TimeSlot($date, $start, $end)),
                ]);
            }
        }
    }
}
