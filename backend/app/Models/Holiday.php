<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * 臨時休業日。休業日1日につき1行（docs/02 の holidays）。
 * 登録・削除は管理画面から行う（手順7の CloseDay・ReopenDay）。
 */
#[Fillable(['date', 'reason'])]
final class Holiday extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // 'YYYY-MM-DD' を日付にする。immutable（変更不可）にして、元の値を書き換える事故を防ぐ
            'date' => 'immutable_date',
        ];
    }
}
