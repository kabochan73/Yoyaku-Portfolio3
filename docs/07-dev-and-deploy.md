# 07. ローカル開発・CI・デプロイ

## リポジトリ構成

```
Yoyaku-Portfolio2/
├── backend/            # Laravel
├── frontend/           # Next.js
├── nginx/              # backend の前段（ローカル・本番）
├── docs/
├── .github/workflows/ci.yml
├── docker-compose.yml
└── README.md
```

## ローカル環境（docker compose）

手元で Node.js を直接使うとき（`npm run lint` など）は、リポジトリのルートで `nvm use` を実行して Node 24 に切り替える（`.nvmrc`）。

R1 と同じ構成。

| サービス | ポート | 役割 |
|---|---|---|
| frontend | 3000 | Next.js（`next dev`） |
| nginx | 8000 | backend（php-fpm）への中継 |
| backend | − | php-fpm |
| queue-worker | − | `php artisan queue:work database --tries=3` |
| scheduler | − | `php artisan schedule:work`（`model:prune`） |
| postgres | 5432 | 開発用 DB `futsal_db` とテスト用 DB `futsal_test` |
| redis | 6379 | カレンダーのキャッシュ・レート制限 |
| mailpit | 8025 / 1025 | メール確認 |

R1 からの変更:

- postgres の初期化スクリプト（`docker/postgres/init.sql`）でテスト用 DB を作り、`btree_gist` 拡張を有効にする
- 環境変数は `.env`（git 管理外）から読み、`docker-compose.yml` に値を直書きしない（R1 は Reverb のキーを直書き）
- backend / queue-worker / scheduler は同じイメージを使うので、`x-backend` の YAML アンカーで共通化する
- ブラウザは `http://localhost:3000/api` を呼び、Next.js の rewrites が `API_URL=http://nginx/api` へ中継する（本番と同じ経路。D16）。`NEXT_PUBLIC_API_URL` は廃止
- nginx の 8000 番ポートはデバッグ用（curl で API を直接叩く）に残す
- ローカルでもバックエンドからの再検証が届くよう、`FRONTEND_INTERNAL_URL=http://frontend:3000` にする（`next dev` では ISR のキャッシュ自体が効かないので、再検証の確認は `next build && next start` で行う）

### 初回セットアップ

```sh
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
docker compose up -d --build
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate --seed
```

`README.md` にも同じ手順を書く。

### よく使うコマンド

| やること | コマンド |
|---|---|
| backend のテスト | `docker compose exec backend php artisan test` |
| backend の静的解析 | `docker compose exec backend ./vendor/bin/phpstan analyse` |
| backend の整形 | `docker compose exec backend ./vendor/bin/pint` |
| frontend のテスト | `docker compose exec frontend npm test` |
| frontend の型チェック | `docker compose exec frontend npx tsc --noEmit` |

## CI（GitHub Actions）

`push`（main）と `pull_request` で実行。

| ジョブ | ステップ |
|---|---|
| backend | `composer install` → **Pint（`--test`）** → **Larastan** → Pest（**PostgreSQL・Redis サービスコンテナ**。マイグレーションも実 DB で流れることを兼ねて確認する） |
| frontend | **Node.js 24** → `npm ci` → ESLint → **Prettier（`--check`）** → `tsc --noEmit` → Jest → **スタブサーバー起動** → `next build`（`BUILD_API_URL` = スタブ）→ **`/` が静的になっているか確認** |

### ビルド用のスタブサーバー

トップは静的ページで、`next build` の中で `/api/facility` を呼ぶ（[05](05-frontend-design.md#ビルド時の-api)）。CI にはバックエンドが無いので、固定の JSON を返す小さなサーバーを立てる。

- `frontend/scripts/build-stub-server.mjs`: `GET /api/facility` だけに答える Node の小さな HTTP サーバー（依存パッケージなし）
- 返す JSON は MSW のテストと同じ `frontend/src/test/fixtures/facility.json` を使う（テストとビルドでデータを二重管理しない）
- `next build` の出力で `/` の行が `○`（Static）になっていなければ CI を失敗させる。うっかりルートレイアウトで `cookies()` を読んでトップが静的でなくなるのを防ぐ

太字が R1 から足すもの。R1 のバックエンドテストは SQLite で、二重予約防止の制約を検証できなかった（D12）。

## 本番（Railway）

R1 と同じ構成で、**Railway に新しいプロジェクト（Yoyaku-Portfolio2）を作る**。R1 のプロジェクトはそのまま残す。

| サービス | 中身 |
|---|---|
| frontend | Next.js（`output: "standalone"`） |
| nginx | backend への中継（公開 URL） |
| backend | php-fpm。起動時に `migrate --force`（`RUN_MIGRATIONS=true` はこのサービスだけ。worker・scheduler では流さない） |
| worker | `php artisan queue:work database` |
| scheduler | `php artisan schedule:work`（`model:prune` を毎日） |
| postgres | Railway の PostgreSQL（`btree_gist` はマイグレーションで有効化） |
| redis | Railway の Redis（カレンダーのキャッシュ・レート制限） |

### R1 からの変更

| 項目 | R1 | R2 |
|---|---|---|
| フロントのビルド | ビルド時に API へ fetch し、届かない場合のフォールバック値を焼き込み、起動時に `/api/revalidate` を叩いて直していた | ビルド時はバックエンドの **公開 URL**（`BUILD_API_URL`）から取る。**届かなければビルド失敗**（フォールバック値なし）。起動時の再検証スクリプトは削除 |
| デプロイの順番 | 決まっていなかった | **初回は backend → frontend の順に手動で**。frontend のビルドがバックエンドの `/api/facility` を必要とするため。2回目以降は同時にデプロイされてもよい（動いている古い backend が同じ形の `/facility` を返すので）。`/facility` のレスポンスの形を変えるときだけ、また backend を先にする |
| 再検証 | `/api/revalidate`（認証なしの GET）をデプロイ時だけ呼ぶ | `/internal/revalidate`（シークレット必須の POST）を設定変更時にバックエンドから呼ぶ |
| backend の entrypoint | `RUN_SEED` / `RUN_ONCE_CMD`（任意の tinker 実行）/ フロントの再検証 | `RUN_MIGRATIONS` のみ。シードや一度きりの作業は Railway のワンオフコマンドで実行（D15） |
| リアルタイム反映 | Reverb サービス（公開 URL、WebSocket） | **Reverb サービスを作らない**。フロントの定期取得（60秒）に置き換え（2026-09-29 決定） |
| Redis | キュー・キャッシュ（完成したカレンダーを月単位でタグ付きキャッシュ） | カレンダーの **日ごとの事実** のキャッシュ（1分）とレート制限だけに使う。キュー・セッションは PostgreSQL（2026-09-29 決定） |
| 設定のキャッシュ | − | 起動時に `config:cache` / `route:cache` / `event:cache` |

### 主な環境変数

backend:

| 変数 | 内容 |
|---|---|
| `APP_URL` / `FRONTEND_URL` | Sanctum・メール内のリンク |
| `SANCTUM_STATEFUL_DOMAINS` | フロントのホスト（ローカルは `localhost:3000`） |
| `TRUSTED_PROXIES` | 内部ネットワークの範囲（B12） |
| `FRONTEND_INTERNAL_URL` | 再検証の呼び先（Railway のプライベートネットワーク上の frontend） |
| `FRONTEND_REVALIDATE_SECRET` | frontend の `REVALIDATE_SECRET` と同じ値 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 管理者（シーダー用） |
| `FACILITY_PHONE` / `FACILITY_EMAIL` | 施設情報 |
| `MAIL_MAILER=resend` / `RESEND_API_KEY` | メール |
| `CACHE_STORE=redis` / `REDIS_URL` | カレンダーのキャッシュ・レート制限 |
| `QUEUE_CONNECTION=database` / `SESSION_DRIVER=database` | キュー・セッション |

frontend は [05-frontend-design.md の環境変数](05-frontend-design.md#環境変数) を参照。本番の frontend は `API_URL`（内部の URL）と `BUILD_API_URL`（公開 URL）の両方をビルド引数で渡す。

> **確認済み（2026-09-29）**: R1 の Railway では nginx サービスに公開ドメイン（`*.up.railway.app`）が付いている。R2 も同じく nginx に公開ドメインを付け、それを `BUILD_API_URL` にする

## リリース前の手動確認

E2E テストを入れない代わりに、デプロイ後に次を手で確認する。

1. 会員登録 → トップで枠を選んで予約 → 完了メールが届く
2. 別のブラウザで同じ週を開いておき、再読み込みしなくても60秒以内に「予約済」に変わる。予約した本人のブラウザではすぐ変わる
3. マイページでキャンセル → キャンセルメールが届く
4. 管理画面で料金を変える → トップを再読み込みすると施設情報の料金が新しくなっている（オンデマンド再検証）
5. 管理画面で予約のある日を臨時休業にする → 確認が出る → 承認すると予約が消え、施設都合メールが届く
6. 管理画面で電話予約を登録・キャンセルできる
7. 会員で `/admin` を開くとトップへ、未ログインで `/mypage` を開くとログイン画面へ移動する
8. 今日の過ぎた時間の枠が「－」になっている。今日の開始済みの予約がマイページで「ご利用中 / ご利用済み」になっている
9. スマホ幅で、トップのカレンダー・ダイアログ・管理カレンダーが崩れない（ページ全体が横にはみ出さない）
10. Railway のログに、エラーが出ていない（`LOG_CHANNEL=stderr`）
11. 別のブラウザで同じ週を開いておき、管理画面で臨時休業日を登録すると、60秒以内にその日が「－」になる（キャッシュが消えている）
12. `GET /api/debug/ip` で、自分の端末の IP が返る（Next.js のコンテナの IP ではない）。Railway の入口が `X-Forwarded-For` を付けているかの確認（B12、[03](03-api.md#クライアントの-ip-をどう取るか)）

## 実装の順番

> CI（GitHub Actions）は最後、本番デプロイの前に作る（2026-09-30 決定）。それまでは、テスト・整形・静的解析を手元で流す。

1. リポジトリ・docker compose・テスト・整形・静的解析の土台（**完了 2026-09-30**）
   - 初日の要検証3つは確認済み:
     - rewrites は `X-Forwarded-For` をそのまま中継するが、付け足さない → 本番（Railway の入口）で付くかをデプロイ時に確かめる（[03](03-api.md#クライアントの-ip-をどう取るか)）
     - トップは `○`（Static）・`Revalidate 1h` でビルドされ、`/internal/revalidate`（`revalidateTag("facility", { expire: 0 })`）の直後の1回目のアクセスから新しい値になる
     - rewrites は `If-None-Match` と `304` をそのまま中継する（[03](03-api.md#カレンダーの-etag--304)）
2. DB（マイグレーション・制約）と制約のテスト（**完了 2026-10-01**。シーダーは手順3に移した）
3. `config/facility.php`・Enum・モデル・Factory・シーダー・`Booking/`（`DayClosure` を含む）・`ClosedDays`（Unit / Feature テスト）（**完了 2026-10-01**）
4. エラー形式（`bootstrap/app.php`）・認証 API と、フロントの `api-client`・共通 UI 部品（`Dialog`, `Button`, `Skeleton`, `ErrorState` など）・`getCurrentUser`・ログイン / 登録画面
5. `/facility`・`/calendar`（`CalendarFacts` の Redis キャッシュも含む）とトップページ（定期取得も含む）。トップを静的ページにし、ビルド用のスタブサーバーもここで作る
6. 予約・キャンセル（Action・Event・メール）とマイページ
7. 管理画面（予約カレンダー → 設定3種 → ユーザー検索）
8. CI（GitHub Actions。backend: Pint・Larastan・Pest、frontend: ESLint・Prettier・tsc・Jest・ビルド・トップが静的かの確認）
9. 本番デプロイと手動確認
