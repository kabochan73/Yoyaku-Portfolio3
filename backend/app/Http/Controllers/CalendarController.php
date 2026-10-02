<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Booking\BookingRules;
use App\Http\Requests\CalendarRequest;
use App\Http\Resources\CalendarDayResource;
use App\Queries\CalendarQuery;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * GET /api/calendar?from=2026-10-05&to=2026-10-11 — 公開のカレンダー（docs/03）。
 *
 * ログインしていなくても使える。誰が呼んでも同じ内容（2026-09-29 決定）。
 * 管理者向けの情報（予約者名など）は、手順7の /admin/calendar に分ける。
 *
 * 組み立ては CalendarQuery（日ごとの事実は Redis にキャッシュ）。ここは「今」を渡して、JSON にするだけ。
 */
final class CalendarController extends Controller
{
    public function __invoke(
        CalendarRequest $request,
        CalendarQuery $calendar,
        BookingRules $rules,
    ): AnonymousResourceCollection {
        $now = now()->toImmutable();

        $days = $calendar->forPublic($request->fromDate(), $request->toDate(), $now);

        return CalendarDayResource::collection($days)->additional([
            // サーバー（日本時間）基準の「今日」と、予約できる最終日（B13）。
            // フロントは週送りの上限をこれで決め、自分では日付を計算しない（端末の時計・タイムゾーンに左右されない）
            'meta' => [
                'today' => $now->toDateString(),
                'bookable_until' => $rules->bookableUntil($now)->toDateString(),
            ],
        ]);
    }
}
