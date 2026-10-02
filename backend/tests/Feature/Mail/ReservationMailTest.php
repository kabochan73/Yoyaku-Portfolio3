<?php

declare(strict_types=1);

use App\Enums\CancellationReason;
use App\Mail\ReservationCancelledMail;
use App\Mail\ReservationConfirmedMail;
use App\Models\Reservation;

/*
 * 予約のメールの中身のテスト（docs/01 の 8、docs/04 の「メール」。D14）。
 * 予約者名・曜日付きの予約日・時間・料金・施設の連絡先が入ることを確かめる。
 */

beforeEach(function () {
    // 2026-10-06 は火曜
    $this->reservation = Reservation::factory()->phone()->on('2026-10-06', 12, 14)->make([
        'booker_name' => '山田太郎',
        'price' => 8000,
    ]);
});

it('予約完了: 件名に施設名、本文に予約内容と施設の連絡先が入る', function () {
    $mail = new ReservationConfirmedMail($this->reservation);

    $mail->assertHasSubject('【FUTSAL PARK】予約完了のお知らせ');
    $mail->assertSeeInHtml('山田太郎 様');
    $mail->assertSeeInHtml('2026年10月6日（火）');
    $mail->assertSeeInHtml('12:00 〜 14:00（2時間）');
    $mail->assertSeeInHtml('¥8,000');
    $mail->assertSeeInHtml('以下の内容でご予約が完了しました。');
    // 施設の連絡先は config/facility.php から（画面と同じ値。D14）
    $mail->assertSeeInHtml(config('facility.phone'));
    $mail->assertSeeInHtml(config('facility.address'));
});

it('施設名・電話番号を変えたら、メールも変わる（直書きしない）', function () {
    config(['facility.name' => 'TEST COURT', 'facility.phone' => '000-0000-0000']);

    $mail = new ReservationConfirmedMail($this->reservation);

    $mail->assertHasSubject('【TEST COURT】予約完了のお知らせ');
    $mail->assertSeeInHtml('000-0000-0000');
});

it('会員のキャンセル: キャンセルを承った文面', function () {
    $mail = new ReservationCancelledMail($this->reservation, CancellationReason::ByMember);

    $mail->assertHasSubject('【FUTSAL PARK】予約キャンセルのお知らせ');
    $mail->assertSeeInHtml('キャンセルを承りました');
    $mail->assertDontSeeInHtml('管理者');
    $mail->assertSeeInHtml('2026年10月6日（火）');
});

it('管理者のキャンセル: 管理者によりキャンセルされた文面', function () {
    $mail = new ReservationCancelledMail($this->reservation, CancellationReason::ByAdmin);

    $mail->assertHasSubject('【FUTSAL PARK】予約キャンセルのお知らせ');
    $mail->assertSeeInHtml('施設の管理者によりキャンセルされました');
});

it('臨時休業日によるキャンセル: 施設都合の件名と、休業の理由が入る', function () {
    $mail = new ReservationCancelledMail($this->reservation, CancellationReason::ByHoliday, '設備点検');

    $mail->assertHasSubject('【FUTSAL PARK】予約キャンセルのお知らせ（施設都合）');
    $mail->assertSeeInHtml('施設の都合により');
    $mail->assertSeeInHtml('休業の理由: 設備点検');
});

it('臨時休業日の理由が無ければ、理由の行を出さない', function () {
    $mail = new ReservationCancelledMail($this->reservation, CancellationReason::ByHoliday);

    $mail->assertDontSeeInHtml('休業の理由');
});
