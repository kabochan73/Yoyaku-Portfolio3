<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
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
| - Unit テスト  : DB に触らないクラス（Booking/ など）を確かめる。
|                  DB は使わないが、エラーメッセージの翻訳（lang/ja）や ValidationException など
|                  Laravel の機能は使うので、Laravel は起動する（TestCase を使う。DB は戻さない）
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

// Unit テスト: Laravel は起動するが、DB もキャッシュも使わないので戻す処理は付けない
pest()->extend(TestCase::class)->in('Unit');

/*
|--------------------------------------------------------------------------
| 共通の関数
|--------------------------------------------------------------------------
|
| 複数のテストファイルで使う関数。Pest はテストファイルを同じ場所に読み込むので、
| 同じ名前の関数を各ファイルに書くと「すでに定義されている」エラーになる。共通のものはここに置く。
|
*/

/**
 * $insert を実行すると、名前が $constraint の DB 制約に違反して失敗することを確かめる。
 *
 * エラーの種類（SQLSTATE）と制約の名前の両方を見る。手順6以降で、この2つを使って
 * DB のエラーを 409（slot_taken など）に変換するので、テストでも同じ2つを確かめておく。
 *
 * よく使う SQLSTATE:
 * - 23P01 … 排他制約の違反（exclusion_violation）。例: 予約の時間帯が重なる
 * - 23505 … 一意制約の違反（unique_violation）。例: 同じ日に2件目の予約、同じ休業日の二重登録
 * - 23514 … CHECK 制約の違反（check_violation）。例: マイナスの金額
 *
 * @param  callable  $insert  制約に違反するはずの書き込み
 * @param  string  $sqlState  期待するエラーの種類
 * @param  string  $constraint  期待する制約（または索引）の名前
 */
function expectViolation(callable $insert, string $sqlState, string $constraint): void
{
    try {
        $insert();
    } catch (QueryException $e) {
        expect($e->getCode())->toBe($sqlState)
            ->and($e->getMessage())->toContain($constraint);

        return;
    }

    test()->fail("制約 {$constraint} に違反するはずが、行が入ってしまった");
}
