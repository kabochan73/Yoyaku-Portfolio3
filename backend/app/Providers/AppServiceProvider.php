<?php

declare(strict_types=1);

namespace App\Providers;

use App\Booking\BookingRules;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // 予約のルールを config/facility.php の値で1つだけ作り、アプリの中で使い回す。
        // コンストラクタで BookingRules を受け取るクラス（Action など）には、これが渡される。
        // テストでは、ルールの値を変えた BookingRules を new で作って直接渡せる
        $this->app->singleton(
            BookingRules::class,
            fn (): BookingRules => BookingRules::fromConfig(config('facility.rules')),
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
