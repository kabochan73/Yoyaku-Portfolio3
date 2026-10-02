<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * 会員検索（GET /api/admin/users?search=山田）の入力チェック（docs/03）。
 * search は必須・1〜255文字（前後の空白は Laravel が自動で落とす。空白だけなら「無い」と同じ）。
 */
final class SearchUsersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'search' => ['required', 'string', 'max:255'],
        ];
    }

    /**
     * LIKE で「この文字を含む」を探すときの形にする。例: 山田 → %山田%
     *
     * 【R1 からの修正】% と _ は LIKE の特別な文字（% = 何文字でも、_ = 任意の1文字）。
     * そのまま渡すと、「_」で検索したときに全員が出てしまう。
     * \ を付けて「ただの文字」として探すようにする（\ 自身も先に \\ にする）。
     */
    public function likePattern(): string
    {
        $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $this->string('search')->toString());

        return "%{$escaped}%";
    }
}
