<?php

declare(strict_types=1);

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * 会員と管理者（docs/01 の「2. ユーザー」）。どちらなのかは role で区別する。
 *
 * 一括代入（User::create([...]) など）で書き込めるのは #[Fillable] に並べた項目だけ。
 * role はあえて入れていない。会員登録の API に {"role": "admin"} を混ぜて送られても、
 * 管理者にならないようにするため。会員は既定値（DB の default）で 'user' になり、
 * 管理者はシーダーで forceFill() を使って明示的に作る（3-3）。
 */
#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            // 文字列 'admin' を UserRole::Admin（Enum）にする（D3）
            'role' => UserRole::class,
        ];
    }

    /**
     * 管理者か。$user->role === UserRole::Admin を毎回書かずに済むようにする。
     */
    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }

    /**
     * この会員の予約（キャンセル済みも含む）。
     * マイページでは $user->reservations()->upcoming() で今後の確定済みの予約に絞る。
     *
     * @return HasMany<Reservation, $this>
     */
    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }
}
