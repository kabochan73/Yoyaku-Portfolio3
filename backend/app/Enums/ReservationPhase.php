<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * 予約の「今の時刻から見た段階」（docs/03 の ReservationResource の phase）。
 *
 * DB には保存しない。予約の時間帯と今の時刻から、読むたびに決める（Reservation::phase()）。
 * マイページで「キャンセル」ボタン・「ご利用中」・「ご利用済み」を出し分けるのに使う（docs/08 の 5.2）。
 * フロントで端末の時計と比べると、時計がずれた端末で表示がずれるので、サーバーで決めて渡す。
 */
enum ReservationPhase: string
{
    /** 開始前（今 < 開始時刻） */
    case BeforeStart = 'before_start';

    /** 利用中（開始時刻 ≦ 今 < 終了時刻）。開始時刻ちょうどは利用中（予約時の B10 と同じ境目） */
    case InUse = 'in_use';

    /** 終了（終了時刻 ≦ 今） */
    case Finished = 'finished';
}
