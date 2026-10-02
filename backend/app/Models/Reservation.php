<?php

declare(strict_types=1);

namespace App\Models;

use App\Booking\TimeSlot;
use App\Enums\ReservationPhase;
use App\Enums\ReservationStatus;
use Carbon\CarbonImmutable;
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
 * 予約の振る舞い: timeSlot()・phase()・isCancellable()（6-1）、cancel()（6-3）。
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
     * 予約の時間帯（日付 + 開始の時 + 終了の時）。料金の計算や、日時の比較に使う。
     */
    public function timeSlot(): TimeSlot
    {
        return new TimeSlot($this->date, $this->start_hour, $this->end_hour);
    }

    /**
     * 今の時刻から見た段階（開始前 / 利用中 / 終了）。
     *
     * 例: 12〜14時の予約
     * - 11:59 → BeforeStart
     * - 12:00 → InUse（開始時刻ちょうどは「始まっている」。予約時の判定 B10 と同じ境目）
     * - 14:00 → Finished
     *
     * 「今」は引数で受け取る（BookingRules と同じ。テストで時刻を自由に与えられる）。
     */
    public function phase(CarbonImmutable $now): ReservationPhase
    {
        $slot = $this->timeSlot();

        if ($now->lt($slot->startsAt())) {
            return ReservationPhase::BeforeStart;
        }

        return $now->lt($slot->endsAt()) ? ReservationPhase::InUse : ReservationPhase::Finished;
    }

    /**
     * キャンセルできるか: 確定済み かつ 開始前（docs/01 の C2）。
     *
     * 【B4】R1 はキャンセル済み・終わった予約でも、API からキャンセルできた（状態を上書きしてメールも送っていた）。
     * マイページの「キャンセル」ボタンを出すか（ReservationResource の is_cancellable）と、
     * キャンセルの処理（6-3 の CancelReservation）の両方で、この同じ判定を使う。
     */
    public function isCancellable(CarbonImmutable $now): bool
    {
        return $this->status === ReservationStatus::Confirmed
            && $this->phase($now) === ReservationPhase::BeforeStart;
    }

    /**
     * キャンセル済みにする（行は消さない。docs/01 の C3）。
     *
     * 状態とキャンセルした日時を一緒に入れる（DB の CHECK 制約 reservations_cancelled_at_check が、
     * 「キャンセル済みなら cancelled_at が必ず入っている」ことを守っている）。
     * キャンセルできるかの判定（isCancellable）とロックは、呼ぶ側の CancelReservation が行う。
     */
    public function cancel(CarbonImmutable $now): void
    {
        $this->status = ReservationStatus::Cancelled;
        $this->cancelled_at = $now;
        $this->save();
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
