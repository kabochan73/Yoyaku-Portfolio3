<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| 予約のルールのエラーメッセージ（BookingRules・CreateReservation・ConflictException などが使う）
|--------------------------------------------------------------------------
|
| :open・:min などの部分には、config/facility.php のルールの値が入る。
| 営業時間などを変えれば、メッセージも一緒に変わる（数字を直接書かない。D1）。
| 画面にはこの文言がそのまま出る（docs/03 の 422 の項目エラー）。
|
*/

return [
    'outside_business_hours' => '営業時間（:open〜:close）の中で選んでください。',
    'invalid_length' => '利用時間は:min〜:max時間で選んでください。',
    'past_date' => '過去の日付は予約できません。',
    'out_of_range' => ':dateより先は予約できません。',
    'already_started' => '開始時刻を過ぎています。',

    // 定休日・臨時休業日（App\Actions\Reservations\CreateReservation。項目エラー date）
    'regular_holiday' => '定休日のため予約できません。',
    'holiday' => '臨時休業日のため予約できません。',

    // 409（App\Exceptions\ConflictException。docs/08 の 3.6・5.3）
    'slot_taken' => 'その時間帯は先に予約されました。別の時間をお選びください。',
    'already_booked_that_day' => 'この日はすでにご予約があります（1日1件まで）。',
    'reservation_not_cancellable' => 'この予約はキャンセルできません（開始済み、またはキャンセル済み）。',

    // カレンダーの期間（App\Http\Requests\CalendarRequest）
    'calendar_range_too_long' => '期間は:days日以内で指定してください。',
];
