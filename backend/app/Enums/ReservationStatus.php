<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * 予約の状態（docs/02 の reservations.status）。
 *
 * キャンセルしても行は消さず、状態を Cancelled に変える（docs/01 の C3）。
 * DB の CHECK 制約にも同じ値を直接書いている（値を増やすときは CHECK 制約も張り替える）。
 */
enum ReservationStatus: string
{
    /** 確定済み。二重予約の判定（排他制約）と1人1日1件の対象になるのは、この状態の予約だけ */
    case Confirmed = 'confirmed';

    /** キャンセル済み。このとき reservations.cancelled_at に日時が入る（DB の CHECK 制約で保証） */
    case Cancelled = 'cancelled';
}
