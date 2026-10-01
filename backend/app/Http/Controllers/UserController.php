<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use Illuminate\Http\Request;

/**
 * ログイン中のユーザー自身に関する API（/api/user 配下。docs/03 の「認証」）。
 *
 * プロフィールの更新（PUT /api/user/profile）は 4-4c で足す。
 */
final class UserController extends Controller
{
    /**
     * GET /api/user — ログイン中のユーザーを返す。
     *
     * 未ログインのときは、ルートの auth:sanctum が 401 unauthenticated を返す（ここまで来ない）。
     * フロントは、ヘッダーの表示（ブラウザ側）と、ログインが必要なページの判定
     * （Server Component の getCurrentUser()）の両方でこれを呼ぶ（docs/05 の「認証とページの保護」）。
     */
    public function show(Request $request): UserResource
    {
        return new UserResource($request->user());
    }
}
