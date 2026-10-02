<?php

declare(strict_types=1);

use App\Http\Controllers\Admin;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\CalendarController;
use App\Http\Controllers\FacilityController;
use App\Http\Controllers\ReservationController;
use App\Http\Controllers\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API のルート（URL の先頭に自動で /api が付く）
|--------------------------------------------------------------------------
|
| 一覧は docs/03-api.md。すべての API に回数制限 'api' が付いている（bootstrap/app.php）。
|
*/

/*
|--------------------------------------------------------------------------
| 公開（ログインしていなくても使える）
|--------------------------------------------------------------------------
*/

// 施設情報・予約のルール・料金・定休日（トップページ・フッター・カレンダーが使う）
Route::get('/facility', FacilityController::class);

// 週ごとの空き状況（誰が呼んでも同じ内容。docs/03）
// - throttle:calendar … 300回/分。画面は60秒ごとに取り直すので、ふつうの API（60回/分）より緩くする。
//                       すべての API に付いている throttle:api（60回/分）は外す（付いたままだと、そちらで止まる）
// - cache.headers     … 中身から ETag を作り、前回と同じなら本文なしの 304 を返す（Laravel 標準）。
//                       private: 途中のキャッシュ（CDN など）には保存させない
//                       no_cache: ブラウザは保存してよいが、使う前に毎回サーバーに確かめる（古い空き状況を使わせない）
Route::get('/calendar', CalendarController::class)
    ->withoutMiddleware('throttle:api')
    ->middleware(['throttle:calendar', 'cache.headers:private;no_cache;etag']);

/*
|--------------------------------------------------------------------------
| 会員登録・ログイン（ログインしていなくても使える）
|--------------------------------------------------------------------------
|
| throttle:login … IP + メールアドレスごとに 5回/分（パスワードの総当たりを防ぐ。AppServiceProvider）
|
*/
Route::middleware('throttle:login')->group(function () {
    Route::post('/register', RegisterController::class);
    Route::post('/login', [SessionController::class, 'store']);
});

/*
|--------------------------------------------------------------------------
| ログインが必要な API
|--------------------------------------------------------------------------
|
| auth:sanctum … ログインのセッション Cookie を確かめる。未ログインなら 401 unauthenticated
|
*/
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [SessionController::class, 'destroy']);

    // ログイン中のユーザー自身
    Route::get('/user', [UserController::class, 'show']);
    Route::put('/user/profile', [UserController::class, 'updateProfile']);

    // 自分の予約（マイページ）
    Route::get('/user/reservations', [ReservationController::class, 'index']);

    // 予約する
    Route::post('/reservations', [ReservationController::class, 'store']);

    // 自分の予約をキャンセルする（行は消さず、状態を変える）
    Route::post('/reservations/{reservation}/cancel', [ReservationController::class, 'cancel']);
});

/*
|--------------------------------------------------------------------------
| 管理者だけが使える API（URL は /api/admin/...）
|--------------------------------------------------------------------------
|
| auth:sanctum … 未ログインなら 401
| can:admin    … 管理者でなければ 403（AppServiceProvider の Gate::define('admin')。docs/04 の「認可」）
|
*/
Route::prefix('admin')->middleware(['auth:sanctum', 'can:admin'])->group(function () {
    // 管理者用のカレンダー（予約の詳細つき）。回数制限と ETag は公開用の /calendar と同じ
    Route::get('/calendar', Admin\CalendarController::class)
        ->withoutMiddleware('throttle:api')
        ->middleware(['throttle:calendar', 'cache.headers:private;no_cache;etag']);

    // 電話予約の登録
    Route::post('/reservations', [Admin\ReservationController::class, 'store']);

    // 予約のキャンセル（誰の予約でも。理由は「管理者によるキャンセル」）
    Route::post('/reservations/{reservation}/cancel', [Admin\ReservationController::class, 'cancel']);

    // 施設の設定（料金・定休日）。返すのは更新後の施設情報（/facility と同じ形）
    Route::put('/prices', [Admin\SettingsController::class, 'updatePrices']);
    Route::put('/regular-holidays', [Admin\SettingsController::class, 'updateRegularHolidays']);

    // 臨時休業日（一覧・登録・解除）
    Route::get('/holidays', [Admin\HolidayController::class, 'index']);
    Route::post('/holidays', [Admin\HolidayController::class, 'store']);
    Route::delete('/holidays/{holiday}', [Admin\HolidayController::class, 'destroy']);

    // 会員検索
    Route::get('/users', [Admin\UserController::class, 'index']);
});

/*
| 利用者の IP の確認用（B12。docs/03 の「クライアントの IP をどう取るか」）。
|
| 本番デプロイ後に、Laravel から見た IP が「Next.js のコンテナ」ではなく「利用者の端末」に
| なっているかを確かめる（docs/07 の手動確認）。
| 使えるのはローカル・テストの環境か、環境変数 DEBUG_IP_ENDPOINT=true のときだけ。
| それ以外は 404（存在しないのと同じ）にする。本番では確かめるときだけ一時的に有効にする。
*/
Route::get('/debug/ip', function (Request $request) {
    $enabled = app()->environment(['local', 'testing']) || config('app.debug_ip_endpoint');
    abort_unless($enabled, 404);

    return [
        // 中継元を信用する設定（trustProxies）を通した結果。正しければ利用者の端末の IP
        'ip' => $request->ip(),
        // 届いたヘッダーそのもの（中継の途中で何が付いたかを見る用）
        'x_forwarded_for' => $request->header('X-Forwarded-For'),
    ];
});
