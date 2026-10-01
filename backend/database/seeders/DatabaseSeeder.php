<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * php artisan db:seed の入口。
 *
 * - InitialDataSeeder（管理者・料金・定休日）… すべての環境で実行する
 * - DemoDataSeeder（デモ会員・予約）……………… ローカル（APP_ENV=local）でだけ自動で実行する。
 *   本番に入れるときは php artisan db:seed --class=DemoDataSeeder と明示する
 */
final class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call(InitialDataSeeder::class);

        if (app()->environment('local')) {
            $this->call(DemoDataSeeder::class);
        }
    }
}
