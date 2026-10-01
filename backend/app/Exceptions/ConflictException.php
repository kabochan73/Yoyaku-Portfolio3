<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

/**
 * 「今のデータの状態とぶつかった」ことを表す例外。API では 409 になる（docs/03 の「422 と 409 の使い分け」）。
 *
 * - 422: リクエストの値そのものが条件を満たしていない（営業時間外・2時間未満 など）。何度送っても失敗する
 * - 409: 値は正しいが、今のデータとぶつかっている（その時間帯はもう埋まっている など）。状況が変われば成功しうる
 *
 * レスポンスへの変換は ApiExceptionRenderer が行う:
 *   { "message": "...", "code": "slot_taken", ...追加情報 }
 *
 * 具体的な作り方（slot_taken・already_booked_that_day など）は、使う手順6・7で static メソッドとして足す。
 * 想定内の失敗なので、ログには残さない（bootstrap/app.php の dontReport）。
 */
final class ConflictException extends RuntimeException
{
    /**
     * @param  string  $errorCode  フロントが分岐に使う名前（例: 'slot_taken'）。docs/03 の「409 の code」
     * @param  string  $message  画面にそのまま出せる日本語のメッセージ
     * @param  array<string, mixed>  $extra  場面ごとの追加情報（例: ['reservation_count' => 2]）。レスポンスにそのまま足される
     */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly array $extra = [],
    ) {
        parent::__construct($message);
    }
}
