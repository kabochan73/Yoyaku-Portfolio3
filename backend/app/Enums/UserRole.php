<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * ユーザーの役割（docs/01 の「2. ユーザー」）。
 *
 * R1 は 'user' / 'admin' の文字列をコードに直接書いていた（D3）。
 * Enum にすると、打ち間違い（'admim' など）が型のエラーとして見つかる。
 *
 * DB の users.role の CHECK 制約にも同じ値を直接書いている（マイグレーションは Enum を参照しない。docs/02）。
 * 値を増やすときは、新しいマイグレーションで CHECK 制約も張り替えること。
 */
enum UserRole: string
{
    /** 会員。会員登録で作られるのは常にこれ */
    case User = 'user';

    /** 管理者。画面からは作れず、シーダーで作る */
    case Admin = 'admin';
}
