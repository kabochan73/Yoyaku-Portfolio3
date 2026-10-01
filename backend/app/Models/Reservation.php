<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ReservationStatus;
use Carbon\CarbonInterface;
use Database\Factories\ReservationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 予約。テーブルの設計と DB の制約は docs/02 と、reservations のマイグレーションを参照。
 *
 * - 時間帯は「時」（整数）で持つ。10〜12時の予約 = start_hour 10, end_hour 12（D6）
 * - キャンセルしても行は消さず、status を Cancelled にして cancelled_at を入れる
 * - 予約者名（booker_name）と金額（price）は予約時点の値。後で会員の名前や料金が変わっても変えない
 *
 * 予約の振る舞い（timeSlot()・isCancellable()・cancel()）は、使う部品ができる手順で足す（3-4・手順6）。
 *
 * 【古い予約の自動削除】
 * 予約日が「管理画面で遡れる範囲（3か月）」より前の予約は、毎日まとめて削除する（docs/01 の「データ保持」）。
 * MassPrunable を付けると、Laravel 標準の `php artisan model:prune` が prunable() の条件で削除する。
 * 毎日の実行は routes/console.php に登録している。
 * R1 は独自のコマンド（reservations:prune-old）を書いていたが、標準の仕組みに置き換えた。
 */
#[Fillable([
    'user_id',
    'date',
    'start_hour',
    'end_hour',
    'status',
    'booker_name',
    'price',
    'cancelled_at',
])]
final class Reservation extends Model
{
    /** @use HasFactory<ReservationFactory> */
    use HasFactory;

    use MassPrunable;

    /**
     * DB の値を PHP の型に変換する設定。
     *
     * - status       … 文字列 'confirmed' を ReservationStatus::Confirmed（Enum）にする（D3）
     * - date         … 'YYYY-MM-DD' を日付にする。immutable（変更不可）にして、
     *                   $reservation->date->addDay() のような操作で元の値を書き換えてしまう事故を防ぐ
     * - cancelled_at … キャンセルした日時（キャンセルしていなければ null）
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ReservationStatus::class,
            'date' => 'immutable_date',
            'start_hour' => 'integer',
            'end_hour' => 'integer',
            'price' => 'integer',
            'cancelled_at' => 'immutable_datetime',
        ];
    }

    /**
     * 削除の対象: 予約日が「今日から admin_lookback_months（3か月）前」の日より前の予約。
     * 状態（確定済み・キャンセル済み）は問わない。
     *
     * 例: 今日が 10/6 なら、7/6 の予約は残り、7/5 以前の予約が消える。
     * subMonthsNoOverflow: 月末で溢れない引き算（5/31 の3か月前は 2/28。B13 と同じ考え方）
     *
     * MassPrunable は1件ずつ読まずに DELETE 文1回でまとめて消す（速いが、モデルのイベントは起きない）。
     * 予約の削除で起きてほしい処理（メールなど）は無いので、これでよい。
     *
     * @return Builder<self>
     */
    public function prunable(): Builder
    {
        $months = (int) config('facility.rules.admin_lookback_months');

        return self::query()->where('date', '<', today()->subMonthsNoOverflow($months)->toDateString());
    }

    /**
     * 予約した会員。電話予約（管理者の代理登録）と、退会した会員の予約は null（B9）。
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * 確定済みの予約だけに絞る。
     * 使い方: Reservation::query()->confirmed()->get()
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function confirmed(Builder $query): void
    {
        $query->where('status', ReservationStatus::Confirmed);
    }

    /**
     * 利用日が $from〜$to（両端を含む）の予約に絞る。カレンダーで1週間分を読むときに使う。
     * 使い方: Reservation::query()->between($monday, $sunday)->get()
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function between(Builder $query, CarbonInterface $from, CarbonInterface $to): void
    {
        $query->whereBetween('date', [$from->toDateString(), $to->toDateString()]);
    }

    /**
     * マイページの「今後の予約」: 今日以降の確定済みの予約を、日付・開始時刻の順に並べる。
     * 今日の予約は、すでに始まっていても含める（「ご利用中 / ご利用済み」と表示する。docs/08 の 5.2）。
     * 使い方: $user->reservations()->upcoming()->get()
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function upcoming(Builder $query): void
    {
        $query->where('status', ReservationStatus::Confirmed)
            ->where('date', '>=', today()->toDateString())
            ->orderBy('date')
            ->orderBy('start_hour');
    }
}
