<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * ログイン中のユーザー自身に関する API（/api/user 配下。docs/03 の「認証」）。
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

    /**
     * PUT /api/user/profile — 名前・メールアドレスと、送られていればパスワードを更新する。
     *
     * 入力チェック（現在のパスワードの確認も含む）は UpdateProfileRequest が済ませている。
     * role などを混ぜて送られても、入力チェックを通った項目しか使わないので変わらない。
     */
    public function updateProfile(UpdateProfileRequest $request): UserResource
    {
        /** @var User $user */
        $user = $request->user();

        $user->name = $request->string('name')->toString();
        $user->email = $request->string('email')->toString();

        // 新しいパスワードがあるときだけ変える。
        // User の casts（'password' => 'hashed'）で、保存するときに自動でハッシュ化される
        if ($request->filled('password')) {
            $user->password = $request->string('password')->toString();
        }

        $user->save();

        return new UserResource($user);
    }
}
