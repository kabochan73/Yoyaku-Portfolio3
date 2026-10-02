<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * キャンセルの理由（docs/04 の「予約のキャンセル」・「認可」）。
 *
 * DB には保存しない（reservations に列は無い。docs/02）。キャンセルのイベント（ReservationCancelled）で
 * メールの Listener に渡し、メールの文面を変えるのに使う（6-4。docs/01 の「メール」）。
 *
 * 会員用と管理者用でルートを分けるのは、この理由が変わるため。
 * 管理者が会員用のルートでキャンセルすると、理由が「会員によるキャンセル」になってしまう。
 */
enum CancellationReason: string
{
    /** 会員が自分でキャンセルした（POST /api/reservations/{id}/cancel。6-3） */
    case ByMember = 'by_member';

    /** 管理者がキャンセルした（手順7の /api/admin/reservations/{id}/cancel） */
    case ByAdmin = 'by_admin';

    /** 臨時休業日の登録で、その日の予約がまとめてキャンセルされた（手順7の CloseDay。施設都合） */
    case ByHoliday = 'by_holiday';
}
