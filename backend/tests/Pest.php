<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| テスト全体の共通設定
|--------------------------------------------------------------------------
|
| Pest のテスト（it(...) / test(...)）は、ここで指定した TestCase を土台に動く。
| 方針は docs/06-testing.md を参照。
|
| - Feature テスト: Laravel のアプリを起動し、API を呼んだり DB を使ったりする
| - Unit テスト  : DB などに触らない純粋なクラス（Booking/ など）を確かめる。
|                  Laravel の起動も不要なので、TestCase は使わない（速い）
|
*/

pest()->extend(TestCase::class)
    // 各テストの前に DB をまっさらな状態にする（マイグレーションを流し、
    // テストごとにトランザクションで囲んで、終わったら巻き戻す）。
    // 前のテストで作った予約が残って、次のテストの結果が変わるのを防ぐ。
    ->use(RefreshDatabase::class)
    ->beforeEach(function () {
        // テスト用のキャッシュ（phpunit.xml で Redis の 15番を指定）を空にする。
        // RefreshDatabase は DB しか戻さないので、キャッシュは自分で消す。
        // これをしないと、前のテストが Redis に残した「カレンダーの事実」を
        // 次のテストが読んでしまい、結果がテストの順番に左右される。
        Cache::flush();
    })
    ->in('Feature');
