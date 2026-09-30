-- PostgreSQL の初回起動時（データが空のとき）に1回だけ実行される SQL。
-- docker-compose.yml で /docker-entrypoint-initdb.d/ に置いている。
--
-- 開発用 DB（futsal_db）は、docker-compose.yml の POSTGRES_DB で自動的に作られる。
-- ここでは、テスト用 DB を追加で作る。
--
-- テストを PostgreSQL で実行する理由（docs/06）:
--   予約の二重登録を防ぐ排他制約（EXCLUDE USING gist）や部分ユニークインデックスは
--   SQLite では再現できない。R1 は SQLite でテストしていたため、これらを確かめられなかった（D12）。
--
-- btree_gist 拡張の有効化はここではしない。マイグレーション（手順2）で行う。
-- 本番の Railway ではこの初期化スクリプトが使えないので、どの環境でも同じ方法にそろえるため。
--
-- ※ このファイルを書き換えても、既存のデータがある場合は実行されない。
--   やり直すときは `docker compose down -v` でデータごと消してから起動する。

CREATE DATABASE futsal_test OWNER futsal;
