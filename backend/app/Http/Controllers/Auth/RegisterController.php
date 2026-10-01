<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

/**
 * 会員登録（POST /api/register）。登録したら、そのままログインした状態にする（R1 と同じ。docs/01）。
 */
final class RegisterController extends Controller
{
    public function __invoke(RegisterRequest $request): JsonResponse
    {
        // 入力チェックを通った値だけを使う（validated()）。
        // role などを混ぜて送られても、ここには入らない。さらに User の #[Fillable] にも role が無いので、
        // 会員は必ず 'user' になる（管理者はシーダーでしか作れない。docs/01）。
        // パスワードは User の casts（'password' => 'hashed'）で、保存するときに自動でハッシュ化される
        $user = User::query()->create($request->validated());

        // ログインした状態にする（セッションにユーザーを記録する）
        Auth::guard('web')->login($user);

        // セッションの ID を新しくする。ログインの前後で同じ ID を使い回すと、
        // 他人が事前に仕込んだ ID でなりすませる（セッション固定攻撃）ため
        $request->session()->regenerate();

        return (new UserResource($user))->response()->setStatusCode(201);
    }
}
