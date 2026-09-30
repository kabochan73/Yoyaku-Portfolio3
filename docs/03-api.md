# 03. API 仕様

- ベース URL: ブラウザからは同一オリジンの `/api`（Next.js の rewrites でバックエンドへ中継。[05](05-frontend-design.md#ブラウザからは常に同一オリジンの-api-を呼ぶ)）
- 認証: Laravel Sanctum の SPA Cookie 認証（R1 と同じ）
  1. `GET /sanctum/csrf-cookie` で `XSRF-TOKEN` を受け取る
  2. 以降のリクエストで `X-XSRF-TOKEN` ヘッダーを付ける（axios の `withXSRFToken`）
- リクエスト / レスポンスは JSON。キーは `snake_case`
- 日付は `YYYY-MM-DD`、時刻は `HH:mm`、日時は ISO 8601（`+09:00` 付き）

## エンドポイント一覧

R1 からの変更は「R1」列に書いた。

### 公開

| メソッド | パス | 説明 | R1 |
|---|---|---|---|
| GET | `/facility` | 施設情報・予約ルール・料金・定休日 | **新規**（R1 の `/prices` と `/regular-holidays` を統合） |
| GET | `/calendar?from=&to=` | 期間の空き状況（誰が呼んでも同じ内容） | R1 は `?month=`。管理者が呼ぶと中身が変わった |

### 認証

| メソッド | パス | 説明 | R1 |
|---|---|---|---|
| POST | `/register` | 会員登録（登録後ログイン状態） | 同じ |
| POST | `/login` | ログイン | 同じ |
| POST | `/logout` | ログアウト | 同じ |
| GET | `/user` | ログイン中のユーザー（未ログインは 401） | 同じ |
| PUT | `/user/profile` | プロフィール更新 | R1 は `/profile` |

> ログイン中のユーザー自身に関するものは `/user` 配下にそろえる（Sanctum の慣習の `/user` に合わせる）。

### 会員

| メソッド | パス | 説明 | R1 |
|---|---|---|---|
| GET | `/user/reservations` | 自分の今日以降の確定済み予約 | R1 は `/my-reservations` |
| POST | `/reservations` | 予約する | 同じ |
| POST | `/reservations/{reservation}/cancel` | 予約をキャンセル | R1 は `DELETE /reservations/{id}` |

> `DELETE` をやめる理由: 行を消すのではなく状態を変える操作なので。

### 管理者（`/admin` 配下、`admin` ロールのみ）

| メソッド | パス | 説明 | R1 |
|---|---|---|---|
| GET | `/admin/calendar?from=&to=` | 管理カレンダー（枠の状態 + 予約の詳細） | **新規**（R1 は `/calendar` と `GET /admin/reservations?month=` の2本） |
| POST | `/admin/reservations` | 電話予約の登録 | 同じ |
| POST | `/admin/reservations/{reservation}/cancel` | 予約をキャンセル | R1 は `DELETE` |
| PUT | `/admin/prices` | 料金を更新 | 同じ（`GET` は `/facility` に統合） |
| PUT | `/admin/regular-holidays` | 定休日を更新 | 同じ（`GET` は `/facility` に統合） |
| GET | `/admin/holidays` | 臨時休業日の一覧（今日以降） | R1 は過去分も全件 |
| POST | `/admin/holidays` | 臨時休業日を登録 | 同じ（確認フローの形式を変更） |
| DELETE | `/admin/holidays/{holiday}` | 臨時休業日を削除 | 同じ |
| GET | `/admin/users?search=` | 会員検索 | 同じ |

## エラー形式

**【R2】** すべてのエラーを次の形にそろえる（D5）。

```json
{
  "message": "人が読むためのメッセージ（画面にそのまま出してよい）",
  "code": "機械が分岐するためのコード（任意）",
  "errors": { "field": ["項目ごとのメッセージ"] }
}
```

| ステータス | 場面 | `code` | `errors` |
|---|---|---|---|
| 401 | 未ログイン | `unauthenticated` | なし |
| 403 | 権限なし（他人の予約・管理者以外） | `forbidden` | なし |
| 404 | 対象が無い | `not_found` | なし |
| 409 | 状態の競合（下表） | 下表 | なし |
| 419 | CSRF トークン切れ | `csrf_token_mismatch` | なし |
| 422 | 入力値の誤り・業務ルール違反 | `validation_failed` | あり |
| 429 | レート制限 | `too_many_requests` | なし |

### 409 の `code`

| `code` | 場面 |
|---|---|
| `slot_taken` | 予約しようとした時間帯がすでに埋まっている（排他制約違反を含む） |
| `already_booked_that_day` | 同じ日に自分の予約がすでにある |
| `reservation_not_cancellable` | キャンセル済み・開始済みの予約をキャンセルしようとした |
| `holiday_has_reservations` | 臨時休業日の登録で、その日に予約がある（確認が必要） |
| `holiday_already_exists` | すでに登録済みの休業日 |

### 項目エラーにするもの

画面で入力欄の下に出せるよう、次は `errors` の項目として返す（R1 は `message` だけで返していた）。

| 場面 | 項目 |
|---|---|
| プロフィール更新で現在のパスワードが違う | `current_password` |
| 予約の時刻が営業時間外・長さが範囲外・過ぎている | `start_hour` / `end_hour` |
| 予約日が期間外・定休日・休業日 | `date` |

ログインの失敗は項目を特定させない（どちらが違うかを教えない）ため、`errors` を付けず `message` のみ。

### 422 と 409 の使い分け

- **422**: リクエストの値そのものが条件を満たしていない（2時間未満、営業時間外、定休日、予約期間外、過去の時刻）。同じリクエストは何度送っても失敗する
- **409**: 値は正しいが、**今のデータの状態** とぶつかっている（他の予約、既存の休業日）。状況が変われば成功しうる

フロントは `409 slot_taken` のときにカレンダーを再取得する。

## 各エンドポイント

### GET `/facility`

トップの施設情報とカレンダーの描画に必要なルールをまとめて返す。フロントはここから営業時間などを受け取り、ハードコードしない（D1）。

```json
{
  "data": {
    "name": "FUTSAL PARK",
    "phone": "092-123-4567",
    "address": "〒000-0000 福岡県福岡市中央区1-2-3",
    "email": "info@futsalpark.example.com",
    "rules": {
      "open_hour": 10,
      "close_hour": 22,
      "min_hours": 2,
      "max_hours": 4,
      "booking_window_months": 1
    },
    "prices": { "weekday": 4000, "weekend": 5000 },
    "regular_holidays": [1]
  }
}
```

### GET `/calendar?from=2026-10-05&to=2026-10-11`

| パラメータ | ルール |
|---|---|
| from, to | 必須、`Y-m-d`、`from <= to`、期間は最大14日 |

```json
{
  "meta": {
    "today": "2026-10-06",
    "bookable_until": "2026-11-06"
  },
  "data": [
    {
      "date": "2026-10-05",
      "closed_reason": "regular_holiday",
      "slots": []
    },
    {
      "date": "2026-10-06",
      "closed_reason": null,
      "slots": [
        { "hour": 10, "status": "past" },
        { "hour": 11, "status": "booked" },
        { "hour": 12, "status": "available" }
      ]
    }
  ]
}
```

- `meta`: サーバー（JST）基準の「今日」と、予約できる最終日。当日の過ぎた時間は枠の `status: past` で表すので、現在時刻は返さない。フロントは週送りの上限をこれで決め、自前で日付計算しない（[04](04-backend-design.md#予約期間1か月後の定義)）
- `closed_reason`: `null` / `regular_holiday` / `holiday` / `out_of_range`（予約期間外）/ `past`（過去日）
- 枠の `status`: `available` / `booked` / `past`（当日の過ぎた時間）
- 受付外の日（`closed_reason` あり）は `slots: []`（予約の有無も見せない）
- **誰が呼んでも同じ内容を返す**（2026-09-29 決定）。管理者向けの情報は `/admin/calendar` に分ける
- サーバー側では日ごとの予約の事実を Redis に60秒キャッシュする（[04](04-backend-design.md#キャッシュ方針)）。書き込みがあった日はすぐ消すので通常は最新だが、まれに最大60秒古いことがある。予約の可否は予約時に DB で確かめるので、古い表示から予約しても二重予約にはならない（`409 slot_taken`）
- R1 は `{"2026-10-06": {"closed": false, "slots": {"10": "available"}}}` の形で、休みの理由が区別できず、キーが文字列の数字だった

### カレンダーの ETag / 304

`GET /calendar` と `GET /admin/calendar` は **ETag を付け、中身が前回と同じなら `304 Not Modified`（本文なし）を返す**（2026-09-29 決定）。60秒ごとの定期取得のうち、変化が無い回の通信量を減らすため。

```php
Route::get('/calendar', ...)->middleware('cache.headers:private;no_cache;etag');
```

- Laravel 標準の `cache.headers` ミドルウェア（`SetCacheHeaders`）を使う。レスポンスの中身のハッシュを ETag にし、`If-None-Match` が一致すれば 304 にする
- `no_cache`: ブラウザは保存してよいが、使う前に毎回サーバーに確認する（古い空き状況をそのまま使わせない）
- `private`: 途中のキャッシュ（CDN など）には保存させない。`/admin/calendar` は予約者名を含むため
- ブラウザが 304 を受けると、保存してある前回の本文を使う。axios・TanStack Query からは普通の 200 に見えるので、フロントのコードは変えない
- **減るのは通信量だけ**。DB の問い合わせと JSON の組み立ては毎回行う（ETag は組み立てた中身から作るため）
- **要検証（実装初日）**: Next.js の rewrites が `If-None-Match` と `304` をそのまま中継するか（[07](07-dev-and-deploy.md#実装の順番)）

### GET `/admin/calendar?from=2026-10-05&to=2026-10-11`

管理カレンダー用。**1週間 = 1リクエスト** で、枠の状態と予約の詳細をまとめて返す（2026-09-29 決定）。R1 は枠の状態（`/calendar`）と予約者名（`/admin/reservations`）を別々に取り、画面側で突き合わせていた。

パラメータは `/calendar` と同じ。

```json
{
  "meta": { "today": "2026-10-06", "bookable_until": "2026-11-06" },
  "data": [
    {
      "date": "2026-10-05",
      "closed_reason": "regular_holiday",
      "slots": [
        { "hour": 10, "status": "closed", "reservation_id": null },
        { "hour": 18, "status": "booked", "reservation_id": 41 },
        { "hour": 19, "status": "booked", "reservation_id": 41 }
      ],
      "reservations": [
        { "id": 41, "date": "2026-10-05", "start_hour": 18, "end_hour": 20, "hours": 2, "price": 8000, "status": "confirmed", "phase": "before_start", "is_cancellable": true, "booker_name": "山田太郎", "user_id": 5, "is_phone": false }
      ]
    }
  ]
}
```

- 枠の `status`: `/calendar` の4種類に加えて `closed`（受付外の日の、予約が無い枠）
- `booked` の枠は `reservation_id` を持つ。予約の中身は日ごとの `reservations`（`AdminReservationResource`）に1回だけ入れる（2〜4枠にまたがる予約を枠ごとに重複させない）
- 受付外の日（定休日・休業日・過去・期間外）も **全12枠を返し、予約がある枠は `booked`**。過去の実績確認と、定休日に残った予約の確認・キャンセルのため（B11）
- 3か月より前の日は `slots: []`、`reservations: []`（予約の保持期間外）
- 電話予約の開始に選べるのは `available` の枠だけ。電話予約も会員と同じルールなので、画面と API の挙動は一致する

### POST `/reservations`

```json
{ "date": "2026-10-06", "start_hour": 12, "end_hour": 14 }
```

- R1 は `start_time: "12:00"` の文字列。R2 は時（整数）で受け取る（D6）
- 成功: `201` + `ReservationResource`
- 失敗: 422（ルール違反）/ 409（`slot_taken`, `already_booked_that_day`）

### ReservationResource

```json
{
  "data": {
    "id": 1,
    "date": "2026-10-06",
    "start_hour": 12,
    "end_hour": 14,
    "hours": 2,
    "price": 8000,
    "status": "confirmed",
    "phase": "before_start",
    "is_cancellable": true,
    "booker_name": "山田太郎"
  }
}
```

- `phase`: 時刻から見た段階。`before_start`（開始前）/ `in_use`（利用中）/ `finished`（終了）。マイページの「ご利用中 / ご利用済み」の表示に使う（[08 §5.2](08-screen-design.md#52-reservationcard)）。フロントで現在時刻と比べない（端末の時計に依存させない）
- `is_cancellable`: `status = confirmed` かつ `phase = before_start`。キャンセルボタンの表示に使う
- 時刻は「時（整数）」だけを返し、`"12:00"` のような表示用の文字列はフロントの `formatHourRange` で作る（表示の形はフロントの責務）
- 管理者向け（`AdminReservationResource`）は `user_id` と `is_phone`（電話予約か）を足す

### UserResource

`/user`、`/login`、`/register`、`/user/profile` が返す。

```json
{ "data": { "id": 1, "name": "山田太郎", "email": "taro@example.com", "role": "user" } }
```

R1 はモデルをそのまま返していたので、`created_at` なども出ていた。

### POST `/reservations/{reservation}/cancel`

- 本人の予約のみ（Policy）。他人の予約は 403
- `confirmed` かつ開始前のみ。それ以外は `409 reservation_not_cancellable`
- 成功: `200` + `ReservationResource`（`status: "cancelled"`）

### POST `/admin/reservations`

```json
{ "date": "2026-10-06", "start_hour": 12, "end_hour": 14, "booker_name": "電話 佐藤" }
```

### POST `/admin/holidays`

```json
{ "date": "2026-10-10", "reason": "設備点検", "cancel_reservations": false }
```

1. 予約がある日に `cancel_reservations: false` → `409 holiday_has_reservations`。件数を返す
   ```json
   { "message": "この日には2件の予約があります。すべてキャンセルして休業日にしますか？", "code": "holiday_has_reservations", "reservation_count": 2 }
   ```
2. 管理者が確認したら `cancel_reservations: true` で再送 → 予約を一括キャンセルして `201` + `HolidayResource`

- エラー形式の3つのキー以外に、場面ごとの追加情報（ここでは `reservation_count`）を足してよい

### HolidayResource

```json
{ "data": { "id": 3, "date": "2026-10-10", "reason": "設備点検" } }
```

### DELETE `/admin/holidays/{holiday}`

成功: `204`（本文なし）

R1 は `force` という名前で、409 のレスポンスに `warning: true` を入れていた。何をするフラグかわかる名前に変え、エラー形式も統一した。

### PUT `/admin/prices`

```json
{ "weekday": 4000, "weekend": 5000 }
```

- 0以上の整数、必須
- 成功: `200` + `/facility` と同じ形（更新後の施設情報）。フロントはこれで `useFacility` のキャッシュを置き換える

### PUT `/admin/regular-holidays`

```json
{ "days": [1, 3] }
```

`days` は空配列を許す（定休日なし）。各値は 0〜6、重複不可。成功: `200` + `/facility` と同じ形。

### GET `/admin/users?search=山田`

`search` は必須・1〜255文字。`like` のワイルドカード（`%`, `_`）はエスケープする（R1 はしていなかった）。大文字小文字を区別しない（PostgreSQL の `ilike`）。

```json
{
  "data": [
    { "id": 5, "name": "山田太郎", "email": "taro@example.com", "confirmed_reservations_count": 3 }
  ],
  "meta": { "limit": 20 }
}
```

## レート制限

| 対象 | 制限 |
|---|---|
| `POST /login`, `POST /register` | IP + メールごとに 5回/分 |
| `GET /calendar`, `GET /admin/calendar` | ユーザー（未ログインは IP）ごとに 300回/分 |
| その他の API | ユーザー（未ログインは IP）ごとに 60回/分 |

- カレンダーだけ緩くする理由: 画面を開いている間60秒ごとに定期取得する（[05](05-frontend-design.md#他の人の操作の反映定期取得)）。学校や会社の Wi-Fi のように同じ IP を大勢が共有していると、未ログインの利用者の定期取得が1つの枠に合算され、60回/分では数十人で制限に当たるため（2026-09-29 決定）
- 名前付きのレートリミッター（`RateLimiter::for('calendar', …)`）として `AppServiceProvider` に定義し、ルートに `throttle:calendar` を付ける

R1 は未設定。

### クライアントの IP をどう取るか

ブラウザ → Next.js（rewrites）→ nginx → Laravel と2段中継されるので、何もしないと `$request->ip()` は **Next.js サーバーの IP** になり、全員が1つの枠を共有してしまう（ログインが全体で5回/分になる）。

- nginx は受け取った `X-Forwarded-For` を引き継ぐ（`proxy_add_x_forwarded_for` 相当。php-fpm には `fastcgi_param HTTP_X_FORWARDED_FOR`）
- Laravel の `TrustProxies` で、内部ネットワーク（Docker / Railway のプライベートネットワーク）からの `X-Forwarded-For` だけを信用する
- **要検証（実装初日）**: Next.js の rewrites が `X-Forwarded-For` を付けて中継するか。付かない場合は `proxy.ts` でヘッダーを付ける
- 検証用に、ローカルで `GET /api/debug/ip`（`APP_ENV=local` のときだけ有効）を用意して確かめる
