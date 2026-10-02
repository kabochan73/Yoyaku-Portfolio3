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
 * 場面ごとの作り方は、下の static メソッド（slotTaken() など）を使う。手順7の休業日の分は、そのときに足す。
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

    /**
     * 予約しようとした時間帯が、すでに埋まっていた（排他制約 reservations_no_overlap の違反。B2）。
     * フロントはこれを受けて、カレンダーを取り直す（docs/03）。
     */
    public static function slotTaken(): self
    {
        return new self('slot_taken', __('booking.slot_taken'));
    }

    /**
     * 同じ日に、自分の確定済みの予約がすでにある（部分ユニーク索引 reservations_user_date_confirmed_unique の違反。B3）。
     */
    public static function alreadyBookedThatDay(): self
    {
        return new self('already_booked_that_day', __('booking.already_booked_that_day'));
    }
}
