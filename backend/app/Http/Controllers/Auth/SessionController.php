<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * ログイン（POST /api/login）とログアウト（POST /api/logout）。
 *
 * ログインの状態は、セッション（Cookie）で持つ（Sanctum の SPA 認証。R1 と同じ）。
 * フロントはログインの前に GET /sanctum/csrf-cookie で CSRF Cookie を受け取っておく（docs/03）。
 */
final class SessionController extends Controller
{
    /**
     * ログイン。成功したらログイン中のユーザーを返す（200）。
     *
     * @throws ValidationException メールアドレスかパスワードが違うとき（422）
     */
    public function store(LoginRequest $request): UserResource
    {
        // メールアドレスとパスワードが合っていれば、ログインした状態にする（セッションにユーザーを記録する）
        if (! Auth::guard('web')->attempt($request->validated())) {
            // 【どちらが違うかは教えない】
            // 「このメールアドレスは登録されていません」と返すと、登録されているメールアドレスを
            // 他人が調べられてしまう。登録されていないメールアドレスでも、パスワード違いでも同じにする。
            //
            // エラーは email や password の欄ではなく 'credentials'（特定の入力欄ではない項目）に付ける。
            // フロントは、入力欄に当てはまらないエラーをフォームの上に出す（docs/05 のフォーム）
            throw ValidationException::withMessages([
                'credentials' => __('auth.failed'),
            ]);
        }

        // セッションの ID を新しくする。ログインの前後で同じ ID を使い回すと、
        // 他人が事前に仕込んだ ID でなりすませる（セッション固定攻撃）ため
        $request->session()->regenerate();

        return new UserResource(Auth::guard('web')->user());
    }

    /**
     * ログアウト。成功したら 204（本文なし）。
     */
    public function destroy(Request $request): Response
    {
        Auth::guard('web')->logout();

        // セッションを破棄し（中身を消して ID も変える）、CSRF トークンも作り直す。
        // ログアウトの後に、前のセッションや CSRF トークンを使い回されないようにする
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
