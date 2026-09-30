<?php

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/*
 * B1: タイムゾーンが日本時間になっていること。
 *
 * R1 は config/app.php の timezone が UTC のままで、日本時間の 0:00〜9:00 に
 * today() が前日を返していた（当日予約の可否や、過去日の判定がずれる）。
 * R2 はアプリ（config/app.php）と PostgreSQL（config/database.php）の両方を
 * Asia/Tokyo にしている。
 *
 * このテストは「土台が PostgreSQL で動いていること」の確認も兼ねている
 * （show timezone は PostgreSQL の命令なので、SQLite では失敗する）。
 */

it('B1: アプリのタイムゾーンは Asia/Tokyo', function () {
    expect(config('app.timezone'))->toBe('Asia/Tokyo');
    expect(now()->getTimezone()->getName())->toBe('Asia/Tokyo');
});

it('B1: PostgreSQL のタイムゾーンも Asia/Tokyo', function () {
    // 接続時に config/database.php の timezone で `set time zone` が流れている
    expect(DB::selectOne('show timezone')->TimeZone)->toBe('Asia/Tokyo');
});

it('B1: UTC ではまだ前日の時刻でも、today() は日本の日付を返す', function () {
    // 日本時間 2026-10-06 08:00 は、UTC では 2026-10-05 23:00（まだ前日）
    $this->travelTo(CarbonImmutable::parse('2026-10-06 08:00', 'Asia/Tokyo'));

    expect(today()->toDateString())->toBe('2026-10-06');
});
