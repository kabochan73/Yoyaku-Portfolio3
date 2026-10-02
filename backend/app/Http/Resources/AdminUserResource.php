<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 会員検索の結果の1人分（docs/03 の GET /admin/users）。
 *
 *   { "id": 5, "name": "山田太郎", "email": "taro@example.com", "confirmed_reservations_count": 3 }
 *
 * パスワードのハッシュなど、決めた以外の項目は出さない（D4）。
 * confirmed_reservations_count は、検索のときに withCount で一緒に数えた値（UserController）。
 *
 * @mixin User
 */
final class AdminUserResource extends JsonResource
{
    /**
     * @return array{id: int, name: string, email: string, confirmed_reservations_count: int}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            // withCount で足した項目は、モデルに宣言された項目ではないので getAttribute で読む
            'confirmed_reservations_count' => (int) $this->resource->getAttribute('confirmed_reservations_count'),
        ];
    }
}
