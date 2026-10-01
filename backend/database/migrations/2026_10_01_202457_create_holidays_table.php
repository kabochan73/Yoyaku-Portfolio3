<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * holidays（臨時休業日）。設計は docs/02 の holidays。
 *
 * 休業日1日につき1行。管理画面から登録・削除する（docs/01 の 6.4）。
 *
 * 「今日以降の日付だけ登録できる」は、日付によって変わるルールなので DB には書かず、
 * アプリ（手順7の CloseDay）で検査する。DB には「同じ日を二重に登録できない」だけを書く。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('holidays', function (Blueprint $table) {
            $table->id();
            // 休業日。同じ日は1行だけ（unique）。
            // 二重登録を同時に試みても DB が止める（手順7で 409 holiday_already_exists に変換する）
            $table->date('date')->unique();
            // 理由（任意）。施設都合キャンセルのメールに載せる
            $table->string('reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('holidays');
    }
};
