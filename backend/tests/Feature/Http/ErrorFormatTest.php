<?php

declare(strict_types=1);

use App\Exceptions\ConflictException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;

/*
 * D5: API のすべてのエラーが { message, code, errors } の形になること（docs/03 の「エラー形式」）。
 *
 * テストの中だけで「わざと例外を投げるルート」を作って確かめる（本物のルートには影響しない）。
 * 本物の API ができたら、それぞれのテストで実際のエラーも確かめる。
 */

beforeEach(function () {
    Route::prefix('api/test-errors')->group(function () {
        Route::get('validation', fn () => throw ValidationException::withMessages([
            'start_hour' => '営業時間（10:00〜22:00）の中で選んでください。',
        ]));
        Route::get('conflict', fn () => throw new ConflictException(
            'holiday_has_reservations',
            'この日には2件の予約があります。',
            ['reservation_count' => 2],
        ));
        Route::get('forbidden', fn () => throw new AuthorizationException);
        Route::get('model-not-found', fn () => throw new ModelNotFoundException);
        Route::get('csrf', fn () => throw new TokenMismatchException);
        Route::get('throttle', fn () => throw new ThrottleRequestsException(headers: ['Retry-After' => 30]));
        Route::get('bad-request', fn () => abort(400));
        Route::get('server', fn () => throw new RuntimeException('秘密の中身: /var/www/html/app/Secret.php'));
        Route::get('only-get', fn () => 'ok');
    });
});

it('422: 入力の誤りは validation_failed で、項目ごとのエラーを errors に入れる', function () {
    $this->getJson('/api/test-errors/validation')
        ->assertStatus(422)
        ->assertExactJson([
            'message' => '入力内容を確認してください。',
            'code' => 'validation_failed',
            'errors' => ['start_hour' => ['営業時間（10:00〜22:00）の中で選んでください。']],
        ]);
});

it('409: ConflictException は、その code・メッセージ・追加情報になる', function () {
    $this->getJson('/api/test-errors/conflict')
        ->assertStatus(409)
        ->assertExactJson([
            'message' => 'この日には2件の予約があります。',
            'code' => 'holiday_has_reservations',
            'reservation_count' => 2,
        ]);
});

it('401: 未ログインは unauthenticated', function () {
    // routes/api.php の GET /api/user（ログインが必要）を、ログインせずに呼ぶ
    $this->getJson('/api/user')
        ->assertStatus(401)
        ->assertExactJson(['message' => 'ログインしてください。', 'code' => 'unauthenticated']);
});

it('403: 権限なしは forbidden', function () {
    $this->getJson('/api/test-errors/forbidden')
        ->assertStatus(403)
        ->assertExactJson(['message' => 'この操作は許可されていません。', 'code' => 'forbidden']);
});

it('404: 存在しない URL も、見つからないモデルも not_found', function (string $url) {
    $this->getJson($url)
        ->assertStatus(404)
        ->assertExactJson(['message' => '見つかりませんでした。', 'code' => 'not_found']);
})->with([
    '存在しない URL' => '/api/no-such-path',
    '見つからないモデル' => '/api/test-errors/model-not-found',
]);

it('405: 使えないメソッドは method_not_allowed', function () {
    $this->postJson('/api/test-errors/only-get')
        ->assertStatus(405)
        ->assertJson(['code' => 'method_not_allowed']);
});

it('419: CSRF トークン切れは csrf_token_mismatch（フロントはこれを見て再送する）', function () {
    $this->getJson('/api/test-errors/csrf')
        ->assertStatus(419)
        ->assertExactJson([
            'message' => 'ページの有効期限が切れました。再読み込みしてください。',
            'code' => 'csrf_token_mismatch',
        ]);
});

it('429: 回数制限は too_many_requests で、Retry-After のヘッダーを残す', function () {
    $this->getJson('/api/test-errors/throttle')
        ->assertStatus(429)
        ->assertHeader('Retry-After', '30')
        ->assertJson(['code' => 'too_many_requests']);
});

it('そのほかの HTTP のエラーは、ステータスはそのままで http_error', function () {
    $this->getJson('/api/test-errors/bad-request')
        ->assertStatus(400)
        ->assertJson(['code' => 'http_error']);
});

it('500: 想定外のエラーは server_error で、中身（ファイルの場所など）を外に出さない', function () {
    // 開発中の設定（APP_DEBUG=true）でも中身を出さないことを確かめる
    config(['app.debug' => true]);

    $response = $this->getJson('/api/test-errors/server');

    $response->assertStatus(500)
        ->assertExactJson([
            'message' => 'サーバーでエラーが発生しました。時間をおいて再度お試しください。',
            'code' => 'server_error',
        ]);
    expect($response->getContent())
        ->not->toContain('秘密の中身')
        ->not->toContain('Secret.php')
        ->not->toContain('trace');
});

it('API 以外のページのエラーは、これまでどおり Laravel の標準の画面になる（JSON にしない）', function () {
    $this->get('/no-such-page')
        ->assertStatus(404)
        ->assertHeader('Content-Type', 'text/html; charset=utf-8');
});
