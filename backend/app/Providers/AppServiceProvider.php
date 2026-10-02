<?php

declare(strict_types=1);

namespace App\Providers;

use App\Booking\BookingRules;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
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
        $this->configureRateLimiting();
    }

    /**
     * 回数制限の種類（docs/03 の「レート制限」）。R1 は回数制限が無かった。
     *
     * 回数は Redis に数える（CACHE_STORE=redis。docs/04 の「Redis の用途」）。
     * IP は、中継元を信用する設定（bootstrap/app.php の trustProxies。B12）を通した、利用者の本当の IP。
     * 制限を超えると 429 too_many_requests になる（ApiExceptionRenderer）。
     */
    private function configureRateLimiting(): void
    {
        // すべての API: ログイン中はユーザーごと、未ログインは IP ごとに 60回/分。
        // bootstrap/app.php の throttleApi() で、すべての API に付けている
        RateLimiter::for('api', fn (Request $request): Limit => Limit::perMinute(60)
            ->by($request->user()?->id ?: $request->ip()));

        // ログイン・会員登録: IP + メールアドレスごとに 5回/分（パスワードの総当たりを防ぐ）。
        // メールアドレスも入れるのは、同じ IP（学校の Wi-Fi など）の別の人を巻き込まないため。4-4 で付ける
        RateLimiter::for('login', fn (Request $request): Limit => Limit::perMinute(5)
            ->by(mb_strtolower((string) $request->input('email')).'|'.$request->ip()));

        // カレンダー: 300回/分。画面を開いている間 60秒ごとに取り直すので、同じ IP を大勢で共有していると
        // 60回/分では数十人で制限に当たるため緩くする（2026-09-29 決定。docs/03）。routes/api.php の /calendar に付けている
        RateLimiter::for('calendar', fn (Request $request): Limit => Limit::perMinute(300)
            ->by($request->user()?->id ?: $request->ip()));
    }
}
