<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * prices（料金）。設計は docs/02 の prices。
 *
 * 平日（weekday）と土日（weekend）の2行だけを持つ。行は手順3のシーダーで作り、
 * 管理画面からは金額だけを更新する（行を増やしたり消したりしない）。
 * 祝日は平日料金（祝日の判定はしない。R1 と同じ。docs/01）。
 *
 * 行が無い状態で予約が作られると、R1 では「null × 時間 = 0円」の予約ができてしまった。
 * その対策は、料金を読む側（手順3の Price::table()）で「行が足りなければ例外」にする。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prices', function (Blueprint $table) {
            $table->id();
            // 'weekday' か 'weekend'。同じ種類の行は1つだけ（unique）
            $table->string('type', 20)->unique();
            // 1時間あたりの料金（円）
            $table->integer('amount_per_hour');
            $table->timestamps();
        });

        // 種類は2つだけ。値は App\Enums\PriceType（手順3）を参照せず直接書く（docs/02）
        DB::statement(<<<'SQL'
            ALTER TABLE prices
            ADD CONSTRAINT prices_type_check
            CHECK (type IN ('weekday', 'weekend'))
        SQL);

        // 料金は0円以上（無料は許す。マイナスは許さない）
        DB::statement(<<<'SQL'
            ALTER TABLE prices
            ADD CONSTRAINT prices_amount_per_hour_check
            CHECK (amount_per_hour >= 0)
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('prices');
    }
};
