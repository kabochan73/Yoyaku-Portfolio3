<?php

declare(strict_types=1);

use App\Exceptions\ApiExceptionRenderer;
use App\Exceptions\ConflictException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Next.js（自分のフロント）から来た API のリクエストで、ログインのセッション Cookie と
        // CSRF の確認を効かせる（Sanctum の SPA 認証。R1 と同じ Cookie 認証）。
        // どのドメインを「自分のフロント」とみなすかは SANCTUM_STATEFUL_DOMAINS（config/sanctum.php）
        $middleware->statefulApi();

        // 【B12】中継元（Next.js・nginx）を信用し、X-Forwarded-For から利用者の本当の IP を取る。
        // ブラウザ → Next.js（rewrites）→ nginx → Laravel と中継されるので、何もしないと
        // $request->ip() がすべて Next.js のコンテナの IP になり、IP ごとの回数制限が全員で1つになる。
        //
        // 信用するのは、内部ネットワーク（プライベートの IP の範囲）から来たリクエストだけ。
        // 外から直接来たリクエストの X-Forwarded-For は信用しない（利用者が書き換えて他人の IP になりすますのを防ぐ）。
        // - 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 … IPv4 のプライベートの範囲（Docker は 172.x）
        // - fd00::/8 … IPv6 のプライベートの範囲（Railway のプライベートネットワークは fd12::）
        // 環境で変わる値ではないので、環境変数にしない
        $middleware->trustProxies(at: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fd00::/8']);

        // すべての API に回数制限 'api' を付ける（中身は AppServiceProvider の RateLimiter::for('api')）
        $middleware->throttleApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // API のすべてのエラーを { message, code, errors } の形にそろえる（D5。docs/03 の「エラー形式」）
        $exceptions->render(new ApiExceptionRenderer);

        // 409（今のデータとぶつかった）は想定内の失敗なので、ログに残さない
        $exceptions->dontReport(ConflictException::class);
    })->create();
