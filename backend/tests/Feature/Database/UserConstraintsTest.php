<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

/*
 * users テーブルの DB 制約のテスト（2-1 で role を追加した分）。
 * expectViolation() は tests/Pest.php の共通の関数。
 */

/**
 * ユーザーを1人、DB に直接入れる
 *
 * @param  array<string, mixed>  $overrides
 */
function insertUserRow(array $overrides = []): void
{
    DB::table('users')->insert(array_merge([
        'name' => '山田太郎',
        'email' => 'taro@example.com',
        'password' => 'dummy',
        'created_at' => now(),
        'updated_at' => now(),
    ], $overrides));
}

it('role を指定しなければ user（会員）になる', function () {
    insertUserRow();

    expect(DB::table('users')->value('role'))->toBe('user');
});

it('role に admin（管理者）は入る', function () {
    insertUserRow(['role' => 'admin']);

    expect(DB::table('users')->value('role'))->toBe('admin');
});

it('role に user・admin 以外は入らない', function () {
    expectViolation(
        fn () => insertUserRow(['role' => 'owner']),
        '23514',
        'users_role_check',
    );
});

it('名前は20文字まで（21文字は入らない）', function () {
    insertUserRow(['name' => str_repeat('あ', 20)]);

    // 22001 = 文字列が長すぎる（string_data_right_truncation）。
    // CHECK 制約ではなく列の長さ（varchar(20)）による制限なので、制約名は出ない。列名で確かめる
    expectViolation(
        fn () => insertUserRow(['email' => 'b@example.com', 'name' => str_repeat('あ', 21)]),
        '22001',
        'character varying(20)',
    );
});
