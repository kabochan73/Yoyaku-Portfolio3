<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    | フロント（Next.js）の作り直しの受け口（docs/04 の「副作用」、B6）。
    | 料金・定休日を変えたとき、RevalidateFrontendCache が internal_url の /internal/revalidate を
    | 合言葉（revalidate_secret）付きで呼び、トップの静的ページを作り直させる。
    | - internal_url: バックエンドから届くフロントの URL。Docker では http://frontend:3000、
    |   本番は Railway のプライベートネットワーク上の frontend（docs/07）
    | - revalidate_secret: フロントの REVALIDATE_SECRET と同じ値
    */
    'frontend' => [
        'internal_url' => env('FRONTEND_INTERNAL_URL'),
        'revalidate_secret' => env('FRONTEND_REVALIDATE_SECRET'),
    ],

];
