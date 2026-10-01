<?php

declare(strict_types=1);

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
| ログインが必要な API
|--------------------------------------------------------------------------
|
| auth:sanctum … ログインのセッション Cookie を確かめる。未ログインなら 401 unauthenticated
|
*/
Route::middleware('auth:sanctum')->group(function () {
    // ログイン中のユーザー自身
    Route::get('/user', [UserController::class, 'show']);
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
