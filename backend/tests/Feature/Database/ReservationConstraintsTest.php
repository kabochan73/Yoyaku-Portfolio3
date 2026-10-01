<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

/*
 * reservations テーブルの DB 制約のテスト（docs/06 の「Feature（DB 制約）」）。
 *
 * アプリのコード（Action など）を通さず、DB に直接行を入れて確かめる。
 * 「アプリのチェックをすり抜けても、DB が止める」ことを示すため。
 * PHP のテストで本当に同時にリクエストを出すのは難しいので、同時アクセスの対策（B2・B3）は
 * 「制約が効いていること」をこの形で確かめる（docs/06 の「同時実行のテストについて」）。
 */

/**
 * 予約を1件、DB に直接入れる。指定しなかった項目は「10/6 の 10〜12時、確定済み、電話予約」になる。
 *
 * @param  array<string, mixed>  $overrides  上書きしたい項目
 */
function insertReservation(array $overrides = []): int
{
    return DB::table('reservations')->insertGetId(array_merge([
        'user_id' => null,
        'date' => '2026-10-06',
        'start_hour' => 10,
        'end_hour' => 12,
        'status' => 'confirmed',
        'booker_name' => '山田太郎',
        'price' => 8000,
        'cancelled_at' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ], $overrides));
}

/** 会員を1人、DB に直接入れて ID を返す */
function insertUser(string $email = 'taro@example.com'): int
{
    return DB::table('users')->insertGetId([
        'name' => '山田太郎',
        'email' => $email,
        'password' => 'dummy',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

// ---------------------------------------------------------------------------
// B2: 二重予約の防止（排他制約 reservations_no_overlap）
// ---------------------------------------------------------------------------

describe('B2: 二重予約の防止', function () {
    it('確定済みの予約と時間帯が重なる予約は入らない', function () {
        insertReservation(['start_hour' => 10, 'end_hour' => 12]);

        // 11〜13時は 10〜12時と 11時台が重なる。23P01 = exclusion_violation（排他制約の違反）
        expectViolation(
            fn () => insertReservation(['start_hour' => 11, 'end_hour' => 13]),
            '23P01',
            'reservations_no_overlap',
        );
    });

    it('時間帯が一部でも重なれば入らない（内側に含まれる場合）', function () {
        insertReservation(['start_hour' => 10, 'end_hour' => 14]);

        expectViolation(
            fn () => insertReservation(['start_hour' => 11, 'end_hour' => 13]),
            '23P01',
            'reservations_no_overlap',
        );
    });

    it('隣り合う時間帯（10〜12時と12〜14時）は入る', function () {
        // 区間は [開始, 終了) なので、12時ちょうどは前の予約に含まれない
        insertReservation(['start_hour' => 10, 'end_hour' => 12]);
        insertReservation(['start_hour' => 12, 'end_hour' => 14]);

        expect(DB::table('reservations')->count())->toBe(2);
    });

    it('別の日なら同じ時間帯でも入る', function () {
        insertReservation(['date' => '2026-10-06']);
        insertReservation(['date' => '2026-10-07']);

        expect(DB::table('reservations')->count())->toBe(2);
    });

    it('キャンセル済みの予約とは重なってよい（同じ枠を取り直せる）', function () {
        insertReservation(['status' => 'cancelled', 'cancelled_at' => now()]);
        insertReservation(); // 同じ 10〜12時

        expect(DB::table('reservations')->count())->toBe(2);
    });
});

// ---------------------------------------------------------------------------
// B3: 1人1日1件（部分ユニーク索引 reservations_user_date_confirmed_unique）
// ---------------------------------------------------------------------------

describe('B3: 1人1日1件', function () {
    it('同じ会員の、同じ日の2件目の確定済み予約は入らない', function () {
        $userId = insertUser();
        insertReservation(['user_id' => $userId, 'start_hour' => 10, 'end_hour' => 12]);

        // 時間帯は重ならない（16〜18時）が、同じ日なので入らない。23505 = unique_violation
        expectViolation(
            fn () => insertReservation(['user_id' => $userId, 'start_hour' => 16, 'end_hour' => 18]),
            '23505',
            'reservations_user_date_confirmed_unique',
        );
    });

    it('キャンセルすれば、同じ日にもう一度予約できる', function () {
        $userId = insertUser();
        insertReservation([
            'user_id' => $userId,
            'status' => 'cancelled',
            'cancelled_at' => now(),
        ]);
        insertReservation(['user_id' => $userId, 'start_hour' => 16, 'end_hour' => 18]);

        expect(DB::table('reservations')->where('user_id', $userId)->count())->toBe(2);
    });

    it('別の会員なら同じ日に予約できる', function () {
        insertReservation(['user_id' => insertUser('a@example.com'), 'start_hour' => 10, 'end_hour' => 12]);
        insertReservation(['user_id' => insertUser('b@example.com'), 'start_hour' => 16, 'end_hour' => 18]);

        expect(DB::table('reservations')->count())->toBe(2);
    });

    it('電話予約（user_id が空）は同じ日に何件でも入る', function () {
        insertReservation(['start_hour' => 10, 'end_hour' => 12]);
        insertReservation(['start_hour' => 14, 'end_hour' => 16]);
        insertReservation(['start_hour' => 18, 'end_hour' => 20]);

        expect(DB::table('reservations')->whereNull('user_id')->count())->toBe(3);
    });
});

// ---------------------------------------------------------------------------
// B9: 会員を削除しても予約は残る
// ---------------------------------------------------------------------------

it('B9: 会員を削除すると、予約は残って user_id が空になる', function () {
    $userId = insertUser();
    $reservationId = insertReservation(['user_id' => $userId]);

    DB::table('users')->where('id', $userId)->delete();

    $reservation = DB::table('reservations')->find($reservationId);
    expect($reservation)->not->toBeNull()
        ->and($reservation->user_id)->toBeNull()
        // 誰の予約だったかは予約者名で分かる
        ->and($reservation->booker_name)->toBe('山田太郎');
});

// ---------------------------------------------------------------------------
// 値の CHECK 制約
// ---------------------------------------------------------------------------

describe('値の CHECK 制約', function () {
    it('開始と終了が同じ・逆転している時刻は入らない', function (int $start, int $end) {
        // 23514 = check_violation（CHECK 制約の違反）
        expectViolation(
            fn () => insertReservation(['start_hour' => $start, 'end_hour' => $end]),
            '23514',
            'reservations_hours_check',
        );
    })->with([
        '同じ' => [12, 12],
        '逆転' => [14, 12],
    ]);

    it('0〜24時の外の時刻は入らない', function (int $start, int $end) {
        expectViolation(
            fn () => insertReservation(['start_hour' => $start, 'end_hour' => $end]),
            '23514',
            'reservations_hours_check',
        );
    })->with([
        '開始がマイナス' => [-1, 2],
        '終了が24時より後' => [22, 25],
    ]);

    it('営業時間外（例: 8〜10時）でも DB は止めない（業務の値はアプリで検査する）', function () {
        // DB に書く制約は「時刻として正しいか」だけ。営業時間は config/facility.php で変わりうるので、
        // アプリ（BookingRules）で検査する（2026-09-29 決定。docs/02 の設計メモ）
        insertReservation(['start_hour' => 8, 'end_hour' => 10]);

        expect(DB::table('reservations')->count())->toBe(1);
    });

    it('金額がマイナスなら入らない', function () {
        expectViolation(
            fn () => insertReservation(['price' => -1]),
            '23514',
            'reservations_price_check',
        );
    });

    it('決められた以外の状態は入らない', function () {
        expectViolation(
            fn () => insertReservation(['status' => 'pending']),
            '23514',
            'reservations_status_check',
        );
    });

    it('状態とキャンセル日時が食い違うと入らない', function (string $status, bool $hasCancelledAt) {
        expectViolation(
            fn () => insertReservation([
                'status' => $status,
                'cancelled_at' => $hasCancelledAt ? now() : null,
            ]),
            '23514',
            'reservations_cancelled_at_check',
        );
    })->with([
        'キャンセル済みなのに日時が無い' => ['cancelled', false],
        '確定済みなのに日時がある' => ['confirmed', true],
    ]);
});
