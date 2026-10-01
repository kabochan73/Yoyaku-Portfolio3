<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * PostgreSQL の btree_gist 拡張を有効にする。
 *
 * reservations の排他制約（二重予約の防止。B2）は、GiST という種類の索引で
 * 「日付が同じ（=）」かつ「時間帯が重なる（&&）」をまとめて判定する。
 * GiST は標準では範囲（int4range）の重なりしか扱えず、date の「=」を扱うにはこの拡張が要る。
 *
 * reservations のマイグレーションより前に流れるよう、ファイル名の日時を早くしている。
 *
 * docker/postgres/init.sql ではなくマイグレーションで有効にするのは、本番（Railway）では
 * 初期化スクリプトを使えないため。どの環境でも同じ方法にそろえる（docs/02）。
 */
return new class extends Migration
{
    public function up(): void
    {
        // すでに有効なら何もしない（テスト用 DB などで何度流しても失敗しないように）
        DB::statement('CREATE EXTENSION IF NOT EXISTS btree_gist');
    }

    public function down(): void
    {
        DB::statement('DROP EXTENSION IF EXISTS btree_gist');
    }
};
