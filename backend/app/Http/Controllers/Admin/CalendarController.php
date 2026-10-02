<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Booking\BookingRules;
use App\Http\Controllers\Controller;
use App\Http\Requests\CalendarRequest;
use App\Http\Resources\AdminCalendarDayResource;
use App\Queries\CalendarQuery;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * GET /api/admin/calendar?from=2026-10-05&to=2026-10-11 — 管理者用のカレンダー（docs/03）。
 *
 * 1週間 = 1リクエストで、枠の状態と予約の詳細をまとめて返す。
 * 入力チェック（期間は最大14日）と meta は、公開用の /calendar（App\Http\Controllers\CalendarController）と同じ。
 * 管理者だけが呼べる（routes/api.php の can:admin）。
 */
final class CalendarController extends Controller
{
    public function __invoke(
        CalendarRequest $request,
        CalendarQuery $calendar,
        BookingRules $rules,
    ): AnonymousResourceCollection {
        $now = now()->toImmutable();

        $days = $calendar->forAdmin($request->fromDate(), $request->toDate(), $now);

        return AdminCalendarDayResource::collection($days)->additional([
            'meta' => [
                'today' => $now->toDateString(),
                'bookable_until' => $rules->bookableUntil($now)->toDateString(),
            ],
        ]);
    }
}
