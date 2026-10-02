{{--
    予約のメールに共通のレイアウト（docs/04 の「メール」。D14）。

    使い方:
        <x-mail.layout title="予約完了のお知らせ" :reservation="$reservation">
            <p>以下の内容でご予約が完了しました。</p>
        </x-mail.layout>

    - 見出し・宛名・予約内容の表・施設の連絡先は、ここで1回だけ書く。
      R1 は3つのテンプレートに同じ CSS と表がコピーされていた
    - 施設名・電話番号・メール・住所は config/facility.php から出す（画面と同じ値。R1 は直接書いていて食い違っていた）
    - 予約日は曜日付き（R1 は曜日なし。docs/01 の 8）
    - メールの表示ソフトは <style> を無視することがあるので、見た目は style 属性に直接書く
--}}
@props(['title', 'reservation'])

@php
    /** @var \App\Models\Reservation $reservation */
    // 例: 2026年10月6日（火）
    $dateLabel = $reservation->date->locale('ja')->isoFormat('YYYY年M月D日（ddd）');
    // 例: 12:00 〜 14:00（2時間）
    $timeLabel = sprintf('%d:00 〜 %d:00（%d時間）', $reservation->start_hour, $reservation->end_hour, $reservation->timeSlot()->hours());
    $cellLabel = 'text-align:left; padding:8px 12px; background-color:#f3f4f6; width:35%; font-weight:normal;';
    $cellValue = 'padding:8px 12px; border-bottom:1px solid #e5e7eb;';
@endphp

<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>{{ $title }}</title>
</head>
<body style="margin:0; font-family:sans-serif; color:#333; line-height:1.6;">
    <div style="max-width:600px; margin:0 auto; padding:24px;">
        <div style="background-color:#16a34a; color:#fff; padding:16px 24px; border-radius:8px 8px 0 0;">
            <h1 style="margin:0; font-size:20px;">{{ $title }}</h1>
        </div>

        <div style="background-color:#f9f9f9; padding:24px; border:1px solid #e5e7eb;">
            <p>{{ $reservation->booker_name }} 様</p>

            {{-- 各メールの本文（何が起きたか） --}}
            {{ $slot }}

            <table style="width:100%; border-collapse:collapse; margin-top:16px;">
                <tr>
                    <th style="{{ $cellLabel }}">予約日</th>
                    <td style="{{ $cellValue }}">{{ $dateLabel }}</td>
                </tr>
                <tr>
                    <th style="{{ $cellLabel }}">時間</th>
                    <td style="{{ $cellValue }}">{{ $timeLabel }}</td>
                </tr>
                <tr>
                    <th style="{{ $cellLabel }}">料金</th>
                    {{-- 予約した時点の金額（D8） --}}
                    <td style="{{ $cellValue }}">¥{{ number_format($reservation->price) }}（現地払い）</td>
                </tr>
            </table>
        </div>

        <div style="text-align:center; font-size:12px; color:#6b7280; margin-top:24px;">
            <p style="margin:0; font-weight:bold;">{{ config('facility.name') }}</p>
            <p style="margin:0;">TEL {{ config('facility.phone') }}　{{ config('facility.email') }}</p>
            <p style="margin:0;">{{ config('facility.address') }}</p>
            <p style="margin:8px 0 0;">このメールは送信専用です。お問い合わせはお電話でお願いいたします。</p>
        </div>
    </div>
</body>
</html>
