<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\FacilityChanged;
use App\Events\ReservationCancelled;
use App\Events\ReservationCreated;
use App\Queries\CalendarFacts;
use Illuminate\Contracts\Events\ShouldHandleEventsAfterCommit;

/**
 * 予約・キャンセルの後に、その日のカレンダーのキャッシュ（Redis）を消す（docs/04 の「キャッシュ方針」「副作用」）。
 * 定休日を変えたとき（FacilityChanged）は、定休日の一覧のキャッシュを消す。
 *
 * 消すと、次にカレンダーを見た人が DB から読み直すので、予約・キャンセルがすぐカレンダーに出る。
 * 消すのはその日のキーだけ。ほかの日のキャッシュは残す（R1 は変更のたびに全部を消していた。D7）。
 *
 * - ShouldHandleEventsAfterCommit: commit の後に動く。commit の前に消すと、その間に別の人が読んで、
 *   まだ反映されていない古い状態を、またキャッシュに入れてしまうことがある
 * - キューには回さない（ShouldQueue を付けない）: 同じリクエストの中で、すぐ消す。
 *   予約した本人がすぐカレンダーを取り直したとき、確実に新しいデータが返るようにするため
 *
 * どのイベントを受けるかは、handle() の引数の型から Laravel が自動で見つける（イベントの自動登録）。
 * 臨時休業日（HolidayChanged）の分は、7-4 で足す。
 */
final readonly class ForgetCalendarCache implements ShouldHandleEventsAfterCommit
{
    public function __construct(
        private CalendarFacts $calendarFacts,
    ) {}

    public function handle(ReservationCreated|ReservationCancelled|FacilityChanged $event): void
    {
        if ($event instanceof FacilityChanged) {
            // 料金はカレンダーのキャッシュに入っていないが、どちらを変えたかを区別するほどの手間ではないので、
            // 施設情報が変わったら定休日の一覧を消す（次に読んだ人が DB から取り直すだけ）
            $this->calendarFacts->forgetRegularHolidays();

            return;
        }

        $this->calendarFacts->forgetDay($event->reservation->date);
    }
}
