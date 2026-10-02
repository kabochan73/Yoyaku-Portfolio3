<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\FacilityChanged;
use Illuminate\Contracts\Queue\ShouldQueueAfterCommit;
use Illuminate\Support\Facades\Http;

/**
 * 料金・定休日を変えたら、フロントにトップの静的ページを作り直させる（docs/04 の「副作用」、B6）。
 *
 * フロントの POST /internal/revalidate を、合言葉（Bearer トークン）付きで呼ぶ。
 * 受けたフロントは、保存している施設情報（タグ facility）を捨て、次のアクセスで作り直す（frontend の route.ts）。
 * R1 は認証なしの GET で、デプロイのときだけ呼んでいた（設定を変えてもトップに出なかった）。
 *
 * - ShouldQueueAfterCommit: キューで、commit の後に呼ぶ。管理者の保存の返事を待たせない。
 *   ロールバックしたら呼ばない（キューに回す Listener には ShouldHandleEventsAfterCommit は効かない。6-4）
 * - 失敗したら（フロントが落ちている・5秒で返事が無い など）、間隔を空けて合計3回まで試す。
 *   それでも失敗したら、トップは1時間ごとの作り直し（frontend の getFacility の revalidate）で直る
 */
final class RevalidateFrontendCache implements ShouldQueueAfterCommit
{
    /** 試す回数（1回目 + やり直し2回） */
    public int $tries = 3;

    /**
     * やり直すまでの秒数（1回目の失敗の後は10秒、2回目の後は60秒）
     *
     * @var list<int>
     */
    public array $backoff = [10, 60];

    public function handle(FacilityChanged $event): void
    {
        $url = rtrim((string) config('services.frontend.internal_url'), '/').'/internal/revalidate';

        Http::withToken((string) config('services.frontend.revalidate_secret'))
            ->acceptJson()
            ->timeout(5)
            ->post($url)
            // 2xx 以外なら例外にして、キューにやり直させる
            ->throw();
    }
}
