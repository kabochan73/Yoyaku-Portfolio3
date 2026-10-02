<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Actions\Holidays\CloseDay;
use App\Actions\Holidays\ReopenDay;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreHolidayRequest;
use App\Http\Resources\HolidayResource;
use App\Models\Holiday;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * 臨時休業日の一覧・登録・解除（docs/03 の「管理者」）。管理者だけが呼べる（can:admin）。
 */
final class HolidayController extends Controller
{
    /**
     * GET /api/admin/holidays — 今日以降の臨時休業日（日付順）。
     * R1 は過去の分も全部返していた。過去の休業日は、管理カレンダーで見られる。
     */
    public function index(): AnonymousResourceCollection
    {
        return HolidayResource::collection(
            Holiday::query()
                ->whereDate('date', '>=', today()->toDateString())
                ->orderBy('date')
                ->get(),
        );
    }

    /**
     * POST /api/admin/holidays — 臨時休業日を登録する。
     *
     * 1. その日に予約があり、cancel_reservations が false → 409 holiday_has_reservations（件数）
     * 2. 管理者が確認したら、cancel_reservations: true で送り直す → 予約を一括キャンセルして 201
     * R1 は force という名前で、409 に warning: true を入れていた。何をするかが分かる名前に変え、エラーの形もそろえた。
     */
    public function store(StoreHolidayRequest $request, CloseDay $closeDay): JsonResponse
    {
        $holiday = $closeDay->handle(
            $request->holidayDate(),
            $request->reason(),
            $request->boolean('cancel_reservations'),
        );

        return HolidayResource::make($holiday)->response()->setStatusCode(201);
    }

    /**
     * DELETE /api/admin/holidays/{holiday} — 臨時休業日を解除する。成功: 204（本文なし）。
     * 登録のときにキャンセルした予約は元に戻らない。
     */
    public function destroy(Holiday $holiday, ReopenDay $reopenDay): Response
    {
        $reopenDay->handle($holiday);

        return response()->noContent();
    }
}
