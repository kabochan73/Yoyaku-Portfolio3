<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * その日に予約を受け付けない理由（docs/03 のカレンダーの closed_reason）。
 *
 * カレンダーでは、上から順に判定して最初に当たったものを使う（docs/04 の「カレンダーの組み立て」）。
 * 予約時の検査でも同じ判定を使い、「カレンダーでは空いて見えるのに予約すると弾かれる」ずれを起こさない。
 *
 * R1 は休みの理由を区別せず「closed: true」だけを返していたので、
 * 管理画面で「定休日なのか臨時休業なのか」が分からなかった。
 */
enum DayClosedReason: string
{
    /** 今日より前の日 */
    case Past = 'past';

    /** 予約できる期間（今日から1か月後の同日まで）より先の日 */
    case OutOfRange = 'out_of_range';

    /** 定休日（曜日で決まる。regular_holidays） */
    case RegularHoliday = 'regular_holiday';

    /** 臨時休業日（日付で決まる。holidays） */
    case Holiday = 'holiday';
}
