<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * users（会員・管理者）と、Laravel 標準の password_reset_tokens・sessions。
 *
 * Laravel が生成したマイグレーションを、R2 の設計（docs/02 の users）に合わせて書き換えている。
 * 新しいプロジェクトなので、変更用のマイグレーションを足さず、このファイルを直接直している。
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            // 入力ルール（20文字以内。docs/01）に合わせる。R1 は varchar(255) だった
            $table->string('name', 20);
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            // 'user'（会員）か 'admin'（管理者）。値の制限は下の CHECK 制約で行う。
            // 会員登録で作られるのは常に 'user'。管理者はシーダーで作る（docs/01）
            $table->string('role', 20)->default('user');
            $table->rememberToken();
            $table->timestamps();
        });

        // role に入れてよい値を DB でも制限する。
        // Laravel の enum() も PostgreSQL では varchar + CHECK になるので中身は同じだが、
        // 制約に名前を付けて、どの制約かを分かりやすくするために自分で書く。
        // 値はアプリの App\Enums\UserRole（手順3）を参照せず、ここに直接書く。
        // マイグレーションは「その時点の DB の形」の記録なので、後で Enum が変わっても意味が変わらないように（docs/02）
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))");

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
