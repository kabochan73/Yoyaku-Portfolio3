<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Resources\FacilityResource;

/**
 * GET /api/facility — 施設情報・予約のルール・料金・定休日をまとめて返す（docs/03）。
 *
 * ログインしていなくても使える。トップページ（静的ページの生成）・フッター・カレンダーが使う。
 * R1 は /prices と /regular-holidays に分かれていたのを、1つにまとめた。
 */
final class FacilityController extends Controller
{
    public function __invoke(): FacilityResource
    {
        return FacilityResource::current();
    }
}
