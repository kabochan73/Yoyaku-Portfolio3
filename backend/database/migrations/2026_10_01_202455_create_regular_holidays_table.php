<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * regular_holidays（定休日の曜日）。設計は docs/02 の regular_holidays。
 *
 * 定休日の曜日1つにつき1行（初期値は月曜の1行。手順3のシーダーで作る）。
 * 全部の行が無ければ「定休日なし」。
 *
 * 管理画面での更新は「全部消して、選ばれた曜日を入れ直す」を1つのトランザクションで行う（手順7）。
 * R1 は truncate してから1件ずつ作っていて、途中で失敗すると定休日が消えたままになった。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('regular_holidays', function (Blueprint $table) {
            $table->id();
            // 曜日。0 = 日曜、1 = 月曜 … 6 = 土曜。Carbon の dayOfWeek と同じ数え方。
            // 同じ曜日は1行だけ（unique）
            $table->smallInteger('day_of_week')->unique();
            $table->timestamps();
        });

        // 曜日として正しい値（0〜6）だけ
        DB::statement(<<<'SQL'
            ALTER TABLE regular_holidays
            ADD CONSTRAINT regular_holidays_day_of_week_check
            CHECK (day_of_week BETWEEN 0 AND 6)
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('regular_holidays');
    }
};
