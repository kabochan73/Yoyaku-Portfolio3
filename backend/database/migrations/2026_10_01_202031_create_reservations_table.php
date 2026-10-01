<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * reservations（予約）。設計は docs/02 の reservations。
 *
 * 【DB に書く制約の線引き】（docs/02 の設計メモ、2026-09-29 決定）
 * - 書く  : 同時アクセスで破れるルール（二重予約・1人1日1件）と、値が変わらない性質
 *           （時刻として正しい、金額は0以上、状態と cancelled_at の整合）
 * - 書かない: 設定で変わりうる業務の値（営業時間 10〜22、利用時間 2〜4 時間など）。
 *           これらは config/facility.php だけに置き、アプリ（BookingRules）で検査する
 *
 * 制約には名前を付ける。手順6で DB のエラーから「どの制約に当たったか」を名前で見分け、
 * 409 slot_taken / already_booked_that_day に変換するため（docs/04 の「二重予約をどう防ぐか」）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservations', function (Blueprint $table) {
            $table->id();

            // 予約した会員。電話予約（管理者の代理登録）は会員と紐づかないので NULL。
            // 【B9】会員を削除しても予約は残し、ここを NULL にする（nullOnDelete）。
            // R1 は cascadeOnDelete で、会員の削除と一緒に予約（売上・利用実績）が消えた。
            // 予約者名は booker_name に残っているので、誰の予約だったかは分かる
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            // 利用日と、開始・終了の「時」（整数）。区間は [start_hour, end_hour)。
            // 例: 10〜12時の予約 = start_hour 10, end_hour 12（12時ちょうどからは次の人が使える）。
            // 【D6】R1 は time 型（"10:00:00"）で持ち、substr で時を切り出していた。
            // 予約は正時単位だけなので整数で持ち、重なりの判定（int4range）も素直に書く
            $table->date('date');
            $table->smallInteger('start_hour');
            $table->smallInteger('end_hour');

            // 'confirmed'（確定済み）か 'cancelled'（キャンセル済み）。キャンセルしても行は消さない（docs/01 の C3）
            $table->string('status', 20)->default('confirmed');

            // 予約時点の予約者名と合計金額。後で会員の名前や料金が変わっても、この予約の記録は変えない（docs/01 の R9・R10）
            $table->string('booker_name');
            $table->integer('price');

            // いつキャンセルされたか。画面では使わない（直前のキャンセルが多いか、などを後から確かめる用）
            $table->timestamp('cancelled_at')->nullable();

            $table->timestamps();

            // 期間で予約を探す（カレンダー・古い予約の削除）ための索引
            $table->index('date');
        });

        // ---------------------------------------------------------------------
        // CHECK 制約（Laravel の Schema Builder では書けないので SQL で書く）
        // ---------------------------------------------------------------------

        // 状態は2種類だけ。値は App\Enums\ReservationStatus（手順3）を参照せず直接書く（docs/02）
        DB::statement(<<<'SQL'
            ALTER TABLE reservations
            ADD CONSTRAINT reservations_status_check
            CHECK (status IN ('confirmed', 'cancelled'))
        SQL);

        // 時刻として正しいこと（0〜24時、開始 < 終了）。
        // 営業時間（10〜22時）や利用時間（2〜4時間）はここに書かない（設定で変わりうる値なので、アプリで検査する）
        DB::statement(<<<'SQL'
            ALTER TABLE reservations
            ADD CONSTRAINT reservations_hours_check
            CHECK (start_hour >= 0 AND start_hour < end_hour AND end_hour <= 24)
        SQL);

        // 金額は0以上
        DB::statement(<<<'SQL'
            ALTER TABLE reservations
            ADD CONSTRAINT reservations_price_check
            CHECK (price >= 0)
        SQL);

        // 「キャンセル済み」と「cancelled_at が入っている」は必ず一致する。
        // 片方だけ更新して、状態とキャンセル日時が食い違うのを防ぐ
        DB::statement(<<<'SQL'
            ALTER TABLE reservations
            ADD CONSTRAINT reservations_cancelled_at_check
            CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
        SQL);

        // ---------------------------------------------------------------------
        // 【B2】二重予約の防止（排他制約）
        // ---------------------------------------------------------------------
        // 確定済みの予約どうしで「同じ日」かつ「時間帯が重なる」行は、DB が入れさせない。
        //
        // R1 は「重なる予約があるか exists() で確かめる → 無ければ create()」だったので、
        // 2つのリクエストが同時に exists() を通ると、両方とも作られてしまった。
        // 排他制約なら DB が原子的に判定するので、同時に来ても必ず片方が失敗する
        // （SQLSTATE 23P01 exclusion_violation）。
        //
        // - date WITH =                              … 日付が同じ
        // - int4range(start_hour, end_hour) WITH &&  … 時間帯 [開始, 終了) が重なる
        //   int4range は既定で「開始を含み、終了を含まない」ので、10〜12時と12〜14時は重ならない
        // - WHERE (status = 'confirmed')            … キャンセル済みの予約は対象外（同じ枠を取り直せる）
        // - USING gist                               … 「重なる」を判定できる索引。date の「=」に btree_gist 拡張を使う
        DB::statement(<<<'SQL'
            ALTER TABLE reservations
            ADD CONSTRAINT reservations_no_overlap
            EXCLUDE USING gist (
                date WITH =,
                int4range(start_hour, end_hour) WITH &&
            ) WHERE (status = 'confirmed')
        SQL);

        // ---------------------------------------------------------------------
        // 【B3】1人1日1件（部分ユニーク索引）
        // ---------------------------------------------------------------------
        // 会員ごとに、同じ日の確定済み予約は1件まで。R1 はアプリのチェックだけで、同時に来ると破れた。
        // 違反すると SQLSTATE 23505 unique_violation。
        //
        // - user_id IS NOT NULL … 電話予約（user_id が NULL）は対象外。管理者は同じ日に何件でも代理登録できる
        // - status = 'confirmed' … キャンセル済みは対象外（キャンセルしたら同じ日にもう一度予約できる）
        //
        // マイページの「自分の今後の予約」の検索（user_id と date で絞る）にも、この索引が使われる
        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX reservations_user_date_confirmed_unique
            ON reservations (user_id, date)
            WHERE status = 'confirmed' AND user_id IS NOT NULL
        SQL);
    }

    public function down(): void
    {
        // 制約と索引はテーブルと一緒に消える
        Schema::dropIfExists('reservations');
    }
};
