<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ユーザーを API で返すときの形（docs/03 の UserResource）。
 *
 *   { "data": { "id": 1, "name": "山田太郎", "email": "taro@example.com", "role": "user" } }
 *
 * 返す項目をここで決めておくことで、パスワードのハッシュや remember_token、created_at などの
 * 画面で使わない項目が、うっかり外に出ないようにする。
 * 【D4】R1 はモデルをそのまま返していた（response()->json($user)）。
 *
 * 使う場所: GET /api/user、会員登録・ログイン・プロフィール更新のレスポンス
 *
 * @mixin User
 */
final class UserResource extends JsonResource
{
    /**
     * @return array{id: int, name: string, email: string, role: string}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            // 'user'（会員）か 'admin'（管理者）。フロントはこれでヘッダーのボタンや遷移先を変える
            'role' => $this->role->value,
        ];
    }
}
