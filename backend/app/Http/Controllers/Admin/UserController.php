<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Enums\ReservationStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SearchUsersRequest;
use App\Http\Resources\AdminUserResource;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * 会員検索（docs/03 の GET /admin/users、docs/01 の 6.5）。管理者だけが呼べる（can:admin）。
 */
final class UserController extends Controller
{
    /** 一度に返す最大の人数。超えるときは、画面で「条件を絞ってください」と出す（docs/08 の 6.7） */
    private const LIMIT = 20;

    /**
     * GET /api/admin/users?search=山田 — 名前かメールアドレスに、その文字を含む会員（名前の順に最大20人）。
     *
     * - 大文字・小文字を区別しない（PostgreSQL の ilike）。% と _ はただの文字として探す（SearchUsersRequest）
     * - 管理者は出さない（会員を探す画面なので）
     * - 予約件数は確定済みの予約だけを数える。withCount で1回の問い合わせにまとめる（人数分の問い合わせにしない）
     */
    public function index(SearchUsersRequest $request): AnonymousResourceCollection
    {
        $pattern = $request->likePattern();

        $users = User::query()
            ->where('role', UserRole::User)
            // (name ilike ? or email ilike ?) をかっこでまとめる（role の条件と混ざらないように）
            ->where(fn (Builder $query) => $query
                ->where('name', 'ilike', $pattern)
                ->orWhere('email', 'ilike', $pattern))
            ->withCount(['reservations as confirmed_reservations_count' => fn (Builder $query) => $query
                ->where('status', ReservationStatus::Confirmed)])
            ->orderBy('name')
            ->orderBy('id')
            ->limit(self::LIMIT)
            ->get();

        return AdminUserResource::collection($users)->additional([
            'meta' => ['limit' => self::LIMIT],
        ]);
    }
}
