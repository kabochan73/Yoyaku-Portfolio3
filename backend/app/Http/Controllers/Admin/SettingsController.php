<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Actions\Settings\UpdatePrices;
use App\Actions\Settings\UpdateRegularHolidays;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdatePricesRequest;
use App\Http\Requests\Admin\UpdateRegularHolidaysRequest;
use App\Http\Resources\FacilityResource;

/**
 * 施設の設定（料金・定休日）の更新（docs/03 の「管理者」）。管理者だけが呼べる（can:admin）。
 *
 * どちらも、更新した後の施設情報を /facility と同じ形で返す。
 * フロントはこれで手元の施設情報（useFacility）を置き換える（取り直しの通信が要らない）。
 * 読み出しの GET は /facility にまとめたので、ここには無い（R1 は /prices と /regular-holidays があった）。
 */
final class SettingsController extends Controller
{
    /** PUT /api/admin/prices — 料金を変える */
    public function updatePrices(UpdatePricesRequest $request, UpdatePrices $updatePrices): FacilityResource
    {
        $updatePrices->handle(
            weekday: $request->integer('weekday'),
            weekend: $request->integer('weekend'),
        );

        return FacilityResource::current();
    }

    /** PUT /api/admin/regular-holidays — 定休日の曜日を変える */
    public function updateRegularHolidays(
        UpdateRegularHolidaysRequest $request,
        UpdateRegularHolidays $updateRegularHolidays,
    ): FacilityResource {
        $updateRegularHolidays->handle($request->days());

        return FacilityResource::current();
    }
}
