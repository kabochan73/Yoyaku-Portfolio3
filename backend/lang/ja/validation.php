<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| 入力チェック（バリデーション）のメッセージ
|--------------------------------------------------------------------------
|
| Laravel の標準のメッセージ（英語）のうち、このアプリで使うものを日本語にしたもの。
| ここに無いメッセージは、英語（フォールバック）で出る。使うルールが増えたら、ここに足す。
|
| :attribute には、下の attributes の日本語の項目名が入る（例: email → メールアドレス）。
| 予約のルール（営業時間など）のメッセージは lang/ja/booking.php、API のエラーは lang/ja/errors.php。
|
*/

return [

    'after_or_equal' => ':attributeは:date以降の日付を指定してください。',
    'array' => ':attributeの形式が正しくありません。',
    'between' => [
        'numeric' => ':attributeは:min〜:maxの間で指定してください。',
        'string' => ':attributeは:min〜:max文字で入力してください。',
    ],
    'boolean' => ':attributeの形式が正しくありません。',
    'confirmed' => ':attributeが確認用と一致しません。',
    'current_password' => '現在のパスワードが正しくありません。',
    'date_format' => ':attributeの形式が正しくありません（:format）。',
    'distinct' => ':attributeに同じ値が含まれています。',
    'email' => ':attributeの形式が正しくありません。',
    'exists' => '選ばれた:attributeは存在しません。',
    'in' => '選ばれた:attributeは正しくありません。',
    'integer' => ':attributeは整数で指定してください。',
    'max' => [
        'numeric' => ':attributeは:max以下で指定してください。',
        'string' => ':attributeは:max文字以内で入力してください。',
    ],
    'min' => [
        'numeric' => ':attributeは:min以上で指定してください。',
        'string' => ':attributeは:min文字以上で入力してください。',
    ],
    'required' => ':attributeを入力してください。',
    'required_with' => ':valuesを変更するときは、:attributeも入力してください。',
    'string' => ':attributeは文字列で入力してください。',
    'unique' => 'この:attributeはすでに使われています。',

    /*
    |--------------------------------------------------------------------------
    | 項目名（:attribute に入る日本語）
    |--------------------------------------------------------------------------
    */

    'attributes' => [
        // 会員登録・ログイン・プロフィール（手順4）
        'name' => '名前',
        'email' => 'メールアドレス',
        'password' => 'パスワード',
        'password_confirmation' => 'パスワード（確認）',
        'current_password' => '現在のパスワード',

        // 予約（手順5〜7）
        'date' => '日付',
        'start_hour' => '開始時刻',
        'end_hour' => '終了時刻',
        'booker_name' => '予約者名',
        'from' => '開始日',
        'to' => '終了日',

        // 管理画面の設定（手順7）
        'weekday' => '平日の料金',
        'weekend' => '土日の料金',
        'days' => '定休日',
        'reason' => '理由',
        'search' => '検索語',
    ],

];
