<?php

declare(strict_types=1);

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/**
 * API（/api/*）で起きた例外を、決まった形の JSON に変換する（D5。docs/03 の「エラー形式」）。
 *
 *   { "message": "画面に出せる日本語", "code": "フロントが分岐に使う名前", "errors": {...} }
 *   ※ errors は 422 のときだけ。409 は場面ごとの追加情報（reservation_count など）を足すことがある
 *
 * 【R1 の問題（D5）】
 * 業務エラーは {"message"} の 422、バリデーションは {"message","errors"} の 422、
 * 休業日の警告は独自形式の 409、と形がばらばらで、フロントが場面ごとに読み方を変える必要があった。
 *
 * 【いつ呼ばれるか】
 * bootstrap/app.php で登録している。Laravel が例外を整理した「後」に呼ばれるので、
 * 「モデルが見つからない」は NotFoundHttpException、「権限が無い」は AccessDeniedHttpException、
 * 「CSRF トークン切れ」は 419 の HttpException に変わってから届く。
 * null を返すと、Laravel の標準の処理に任せる（/api 以外のページなど）。
 */
final class ApiExceptionRenderer
{
    public function __invoke(Throwable $e, Request $request): ?JsonResponse
    {
        // API 以外（Laravel のトップページなど）は標準の処理に任せる
        if (! $request->is('api/*')) {
            return null;
        }

        // 中身がすでに決まっているレスポンス（abort(response(...)) など）は、そのまま返させる
        if ($e instanceof HttpResponseException) {
            return null;
        }

        return match (true) {
            // 入力の誤り・予約のルール違反（BookingRules など）。項目ごとのメッセージを errors に入れる
            $e instanceof ValidationException => $this->json(422, 'validation_failed', __('errors.validation_failed'), [
                'errors' => $e->errors(),
            ]),

            // 今のデータとぶつかった（その時間帯はもう埋まっている など）。code と追加情報は例外が持っている
            $e instanceof ConflictException => $this->json(409, $e->errorCode, $e->getMessage(), $e->extra),

            $e instanceof AuthenticationException => $this->json(401, 'unauthenticated', __('errors.unauthenticated')),

            $e instanceof AccessDeniedHttpException => $this->json(403, 'forbidden', __('errors.forbidden')),

            $e instanceof NotFoundHttpException => $this->json(404, 'not_found', __('errors.not_found')),

            $e instanceof MethodNotAllowedHttpException => $this->json(405, 'method_not_allowed', __('errors.method_not_allowed')),

            // 回数制限。「何秒後に再試行できるか」（Retry-After）などのヘッダーを残す。
            // フロントはこれを見て「しばらくしてから」と案内できる
            $e instanceof ThrottleRequestsException => $this->json(429, 'too_many_requests', __('errors.too_many_requests'))
                ->withHeaders($e->getHeaders()),

            // CSRF トークン切れ（TokenMismatchException は Laravel が 419 の HttpException に変えてから届く）。
            // フロントの api-client は、この code を見て CSRF Cookie を取り直し、1回だけ再送する（docs/05）
            $e instanceof HttpExceptionInterface && $e->getStatusCode() === 419 => $this->json(419, 'csrf_token_mismatch', __('errors.csrf_token_mismatch')),

            // そのほかの HTTP のエラー（abort(400) など）。ステータスはそのまま使う
            $e instanceof HttpExceptionInterface => $this->json($e->getStatusCode(), 'http_error', __('errors.http_error'))
                ->withHeaders($e->getHeaders()),

            // 想定外のエラー。中身（どのファイルの何行目で何が起きたか）は外に出さない。
            // 詳細は Laravel がログに残す（本番は Railway のログ。LOG_CHANNEL=stderr）。
            // R1 は開発中の設定のまま、例外の種類やファイルの場所まで返していた
            default => $this->json(500, 'server_error', __('errors.server_error')),
        };
    }

    /**
     * エラーの JSON を作る。
     *
     * @param  array<string, mixed>  $extra  message・code の後ろに足す項目（errors・reservation_count など）
     */
    private function json(int $status, string $code, string $message, array $extra = []): JsonResponse
    {
        return new JsonResponse(['message' => $message, 'code' => $code, ...$extra], $status);
    }
}
