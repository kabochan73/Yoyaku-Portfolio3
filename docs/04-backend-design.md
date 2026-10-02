# 04. バックエンド設計（Laravel）

## 方針

1. **Controller は「受け取って、渡して、返す」だけ**にする。1アクション10行程度が目安
2. 役割ごとに置き場所を決める。迷ったら下の表に従う
3. **守らなければいけないルールは DB 制約 → Action → FormRequest の順に強い場所で守る**。画面の制限は使いやすさのためで、守りの役には数えない
4. 抽象化は「2か所以上で使う」か「テストで差し替える」ときだけ。Repository 層やインターフェースは作らない（Eloquent をそのまま使う）

| 役割 | 置き場所 | R1 での置き場所 |
|---|---|---|
| 入力の形式チェック（型・必須・形式） | `Http/Requests`（FormRequest） | Controller の `$request->validate()` |
| 認可（誰が操作してよいか） | `Policies`、`Gate`、ルートの `can:` ミドルウェア | Controller の `if` と独自 `AdminMiddleware` |
| 業務ルールのチェックと更新処理 | `Actions` | Controller と `ReservationService` |
| 予約ルールの定数 | `config/facility.php` | Service・Controller・フロントに散在 |
| 参照用の組み立て（カレンダー） | `Queries` | `CalendarController` |
| レスポンスの形 | `Http/Resources` | `response()->json($model)` と手書き `map` |
| 副作用（メール・フロントの再検証） | `Events` + `Listeners` | Controller に直書き |
| 固定の選択肢 | `Enums`（backed enum） | 文字列リテラル |

## ディレクトリ構成

```
backend/
├── app/
│   ├── Actions/
│   │   ├── Reservations/
│   │   │   ├── CreateReservation.php
│   │   │   └── CancelReservation.php
│   │   ├── Holidays/
│   │   │   ├── CloseDay.php            # 臨時休業日の登録（予約の一括キャンセル込み）
│   │   │   └── ReopenDay.php           # 臨時休業日の削除
│   │   └── Settings/
│   │       ├── UpdatePrices.php
│   │       └── UpdateRegularHolidays.php
│   ├── Booking/                        # 予約の「値」とルール（DB に触らないクラス）
│   │   ├── TimeSlot.php                # 日付 + 開始時 + 終了時 の値オブジェクト
│   │   ├── BookingRules.php            # config/facility.php の値を持ち、TimeSlot の時刻・期間を検査する
│   │   ├── PriceTable.php              # 平日・土日の単価の値オブジェクト。priceFor(TimeSlot) で金額も計算する
│   │   ├── DayClosure.php              # 定休日・休業日の判定（純粋関数。予約時とカレンダーで共通）
│   ├── Enums/
│   │   ├── UserRole.php
│   │   ├── ReservationStatus.php
│   │   ├── PriceType.php
│   │   ├── CancellationReason.php      # by_member / by_admin / by_holiday
│   │   ├── DayClosedReason.php         # regular_holiday / holiday / out_of_range / past
│   │   └── SlotStatus.php              # available / booked / past
│   ├── Events/
│   │   ├── ReservationCreated.php
│   │   ├── ReservationCancelled.php
│   │   ├── HolidayChanged.php          # 臨時休業日の登録・削除（カレンダーのキャッシュを消す）
│   │   └── FacilityChanged.php         # 料金・定休日の変更（フロントの再検証・キャッシュを消す）
│   ├── Exceptions/
│   │   └── ConflictException.php       # 409 を返す業務例外
│   ├── Http/
│   │   ├── Controllers/                # Auth/ Admin/ と会員向け
│   │   ├── Requests/
│   │   └── Resources/
│   ├── Listeners/
│   │   ├── SendReservationConfirmedMail.php
│   │   ├── SendReservationCancelledMail.php
│   │   ├── RevalidateFrontendCache.php   # FacilityChanged → フロントの再検証を呼ぶ
│   │   └── ForgetCalendarCache.php       # 書き込み → カレンダーのキャッシュを消す（同期）
│   ├── Mail/
│   ├── Models/
│   ├── Policies/
│   │   └── ReservationPolicy.php
│   └── Queries/
│       ├── CalendarQuery.php
│       ├── CalendarFacts.php           # 日ごとの「事実」の読み出し（Redis にキャッシュ）
│       └── ClosedDays.php              # 予約時の定休日・休業日の判定（キャッシュを使わず DB を見る）
├── config/
│   └── facility.php
└── resources/views/mail/
    ├── layout.blade.php                # 共通レイアウト（D14）
    ├── reservation-confirmed.blade.php
    ├── reservation-cancelled.blade.php
    └── reservation-cancelled-by-holiday.blade.php
```

## 設定: `config/facility.php`

予約ルールと施設情報の **唯一の定義場所**（D1, D14）。

```php
return [
    'name' => 'FUTSAL PARK',
    'phone' => env('FACILITY_PHONE', '092-123-4567'),
    'address' => '〒000-0000 福岡県福岡市中央区1-2-3',
    'email' => env('FACILITY_EMAIL', 'info@futsalpark.example.com'),

    'rules' => [
        'open_hour' => 10,
        'close_hour' => 22,
        'min_hours' => 2,
        'max_hours' => 4,
        'booking_window_months' => 1,
        'admin_lookback_months' => 3,   // 管理画面で遡れる範囲 = 予約の保持期間
    ],

    'admin' => [
        'email' => env('ADMIN_EMAIL'),
        'password' => env('ADMIN_PASSWORD'),
    ],
];
```

- `BookingRules` はコンストラクタでこの配列を受け取る（`AppServiceProvider` で singleton 登録）。テストでは値を変えたインスタンスを作れる
- ルールの値はここだけに置く。DB の CHECK 制約には業務の値を書かない（[02](02-database-design.md#設計メモ)）ので、営業時間などを変えるときはこのファイルだけ直せばよい

## タイムゾーン

**【B1】** R1 は `config/app.php` の `timezone` が `UTC` のままで、`Carbon::today()` が JST の 0:00〜9:00 に前日を返していた。

- `config/app.php`: `'timezone' => 'Asia/Tokyo'`
- `config/database.php` の pgsql 接続: `'timezone' => 'Asia/Tokyo'`（`now()` など DB 側の時刻もそろえる）
- 「今」は必ず `now()` / `today()` で取る（テストで `$this->travelTo()` できるように）。`new DateTime()` や `time()` は使わない

## 値オブジェクト: `TimeSlot`

R1 は `"10:00"` の文字列を `substr` で切り出して計算していた（D6）。予約の時間帯を1つの値として扱う。

```php
final readonly class TimeSlot
{
    public function __construct(
        public CarbonImmutable $date,
        public int $startHour,
        public int $endHour,
    ) {}

    public function hours(): int;                 // end - start
    public function startsAt(): CarbonImmutable;  // date + startHour
    public function isWeekend(): bool;
}
```

予約できるかの判定は、**DB を見ずに決まるもの** と **DB を見るもの** で置き場所を分ける。

```php
// Booking/BookingRules.php — DB に触らない。config の値と「今」だけで判定する
final class BookingRules
{
    /** 営業時間・長さ・過去・予約期間を検査する。違反は ValidationException（422） */
    public function assertValidSlot(TimeSlot $slot, CarbonImmutable $now): void;

    public function bookableUntil(CarbonImmutable $today): CarbonImmutable;
}

// Booking/DayClosure.php — DB に触らない。「定休日の一覧」と「休業日か」から理由を決める
final class DayClosure
{
    public static function reason(CarbonImmutable $date, array $regularHolidays, bool $isHoliday): ?DayClosedReason;
}

// Queries/ClosedDays.php — 予約時用。キャッシュを使わず、その場で DB を見る
final class ClosedDays
{
    /** その日が休みなら理由（regular_holiday / holiday）、営業日なら null */
    public function reasonFor(CarbonImmutable $date): ?DayClosedReason;
}
```

- `BookingRules` は `$now` を引数で受け取るので、テストで時刻を自由に与えられる（Unit テストで DB が要らない）
- 「定休日・休業日か」の判定ルールは `DayClosure` 1か所にまとめる。予約時（`ClosedDays` が DB から読んだ値を渡す）とカレンダー（`CalendarFacts` がキャッシュから読んだ値を渡す）で同じルールを使う。R1 は予約時（`ReservationController`）とカレンダー（`CalendarController`）で別々に書いていた
- **予約時の判定はキャッシュを使わない**。予約の可否は正確でなければならないので、必ず DB を見る（キャッシュは表示のためだけ）

| チェック | 会員 | 電話予約 | 方法 |
|---|---|---|---|
| 営業時間内 / 2〜4時間 | ○ | ○ | `BookingRules` |
| 開始が現在より後（B10） | ○ | ○ | `BookingRules` |
| 1か月以内 | ○ | ○ | `BookingRules` |
| 定休日・臨時休業日でない | ○ | ○ | `ClosedDays` |
| 他の予約と重ならない | ○ | ○ | **DB の排他制約** |
| 1人1日1件 | ○ | − | **DB の部分ユニークインデックス**（電話予約は `user_id` が NULL なので自然に対象外になる） |

**電話予約も会員と同じルールにする**（2026-09-29 決定）。R1 は API では電話予約に「1か月以内」「定休日・休業日でない」を当てていなかったが、管理カレンダーではその枠を選べず、使えない例外になっていた。免除は「1人1日1件」だけで、これは DB 側で `user_id` の有無によって決まるので、アプリのルールは1つで済む。

### 予約期間（「1か月後」）の定義

- 予約できる最終日 = `today()->addMonthsNoOverflow(booking_window_months)`（その日を含む）
  - 例: 10/6 → 11/6、1/31 → 2/28（うるう年は 2/29）
- R1 はサーバーが `addMonth()`（1/31 → 3/3 に溢れる）、フロントが `+31日` で、最終日が一致していなかった
- フロントでは計算しない。カレンダー API のレスポンスに `bookable_until` を入れて渡す（[03](03-api.md#get-calendarfrom2026-10-05to2026-10-11)）

## 予約の作成

`CreateReservation`

```php
final class CreateReservation
{
    public function __construct(
        private BookingRules $rules,
        private ClosedDays $closedDays,
    ) {}

    public function forMember(User $user, TimeSlot $slot): Reservation
    {
        return $this->create($slot, $user->name, $user);
    }

    public function forPhone(string $bookerName, TimeSlot $slot): Reservation
    {
        return $this->create($slot, $bookerName, null);
    }

    private function create(TimeSlot $slot, string $bookerName, ?User $user): Reservation
    {
        return DB::transaction(function () use (...) {
            $this->lockDate($slot->date);   // 臨時休業日の登録と直列化する（後述）
            $this->rules->assertValidSlot($slot, now()->toImmutable());
            $this->assertOpen($slot->date);  // ClosedDays。ロック取得後に検査する（後述）

            try {
                $reservation = Reservation::create([
                    // ...
                    'price' => Price::table()->priceFor($slot),
                ]);
            } catch (QueryException $e) {
                throw $this->toConflict($e); // 23P01 → slot_taken / 23505 → already_booked_that_day
            }

            ReservationCreated::dispatch($reservation);

            return $reservation;
        });
    }
}
```

会員と電話予約の違いは「予約者名をどこから取るか」と「`user_id` を入れるか」だけ（Controller の例は[後述](#controller-の例)）。

`slot_taken`（時間帯が埋まっていた）で失敗したときは、**その日のカレンダーのキャッシュを消してから** 409 を返す。「カレンダーでは空きに見えたのに埋まっていた」ことが分かった時点で、古いキャッシュを捨てるため（[キャッシュ方針](#キャッシュ方針)）。トランザクションはロールバック済みなので、消すのはトランザクションの外で行う。

### 二重予約をどう防ぐか（B2, B3）

R1 は「重なる予約があるか `exists()` → なければ `create()`」だったので、2つのリクエストが同時に `exists()` を通ると両方作られる。

R2 はチェックせずに INSERT し、DB の制約違反を捕まえる。

| 制約 | SQLSTATE | 返すエラー |
|---|---|---|
| 排他制約（時間帯の重なり） | `23P01` exclusion_violation | `409 slot_taken` |
| 部分ユニークインデックス（1人1日1件） | `23505` unique_violation | `409 already_booked_that_day` |

どちらの制約に当たったかは例外メッセージ内の制約名で判定する。

### 臨時休業日との競合

「会員が予約する」と「管理者がその日を休業日にする」が同時に起きると、次の順で休業日に予約が残りうる。

1. 会員: 休業日でないことを確認
2. 管理者: 休業日を登録し、その日の予約（まだ無い）をキャンセルして commit
3. 会員: 予約を INSERT して commit → 休業日なのに予約がある

これを防ぐため、`CreateReservation` と `CloseDay` の両方でトランザクションの最初に **日付ごとのアドバイザリロック** を取る。

```php
DB::statement('SELECT pg_advisory_xact_lock(?)', [crc32('reservation-date:'.$date->toDateString())]);
```

休業日チェック（`ClosedDays`）はロック取得後に行う。上のコードで `assertOpen()` をトランザクションの中、`lockDate()` の後に呼んでいるのはこのため。

## 予約のキャンセル

`CancelReservation`

```php
public function handle(Reservation $reservation, CancellationReason $reason, ?string $note = null): Reservation
{
    return DB::transaction(function () use (...) {
        $reservation = Reservation::lockForUpdate()->findOrFail($reservation->id);

        if (! $reservation->isCancellable()) {   // confirmed かつ開始前
            throw ConflictException::reservationNotCancellable();
        }

        $reservation->cancel();                   // status と cancelled_at を更新
        ReservationCancelled::dispatch($reservation, $reason, $note);

        return $reservation;
    });
}
```

- **【B4】** R1 はキャンセル済み・過去の予約でも `status` を上書きしてメールを送っていた
- 行ロック（`lockForUpdate`）で、会員と管理者が同時にキャンセルしてもメールが2通にならないようにする
- 認可は Action の外（Controller の `$this->authorize('cancel', $reservation)`）。会員は本人の予約のみ、管理者は全件

## 臨時休業日の登録

`CloseDay`（**【B7】** R1 は Controller の foreach でトランザクションなし）

```
DB::transaction:
  1. 日付のアドバイザリロック
  2. その日の「確定済み かつ 開始前」の予約を lockForUpdate で取得
  3. 予約があり、cancel_reservations = false → ConflictException(holiday_has_reservations, 件数)
  4. holidays に INSERT（UNIQUE 違反 → holiday_already_exists）
  5. 予約を1件ずつ CancelReservation（reason = by_holiday, note = 理由）
  6. HolidayChanged(date) を dispatch
```

臨時休業日の削除（`ReopenDay`）も `HolidayChanged(date)` を dispatch する。

- 手順2で **開始済みの予約を最初から除く**。含めてしまうと、手順5で `CancelReservation` の「開始前のみ」チェックに当たって例外になり、登録全体が失敗する。確認ダイアログの件数も実際にキャンセルされる件数とずれる
- 当日の休業登録では、開始済み（利用中・利用済み）の予約はそのまま残る。利用実績として正しい

- メールは各 `ReservationCancelled` のリスナーから、**commit 後に** キューへ積まれる。途中で失敗してロールバックしたら1通も送られない
- 休業日にできるのは今日以降の日付のみ（R1 は過去日も登録できた）

## 副作用（Event/Listener）

R1 は予約・キャンセルの Controller それぞれに「キャッシュ削除・メール送信・broadcast」を直書きしていた（D2）。R2 はイベントを発行するだけにし、何が起きるかは Listener の一覧で追えるようにする。

| イベント | リスナー | 内容 |
|---|---|---|
| `ReservationCreated` | `SendReservationConfirmedMail` | 会員の予約なら完了メール |
| | `ForgetCalendarCache` | その日のカレンダーのキャッシュを消す |
| `ReservationCancelled` | `SendReservationCancelledMail` | 会員の予約なら、理由に応じてキャンセル / 施設都合キャンセルのメール |
| | `ForgetCalendarCache` | その日のカレンダーのキャッシュを消す |
| `HolidayChanged`（臨時休業日の登録・削除。`CloseDay` / `ReopenDay` が dispatch） | `ForgetCalendarCache` | その日のカレンダーのキャッシュを消す |
| `FacilityChanged`（料金・定休日の変更。`UpdatePrices` / `UpdateRegularHolidays` が dispatch） | `RevalidateFrontendCache` | フロントの `POST /internal/revalidate` を呼び、トップの静的ページを作り直させる（B6） |
| | `ForgetCalendarCache` | 定休日のキャッシュを消す |

- メール系と `RevalidateFrontendCache` は `ShouldQueue` + `ShouldHandleEventsAfterCommit`。**commit 前に送らない・API の応答を待たせない**（B8）
- `ForgetCalendarCache` だけは **キューに回さない**（`ShouldHandleEventsAfterCommit` のみ）。commit 直後に同じリクエストの中で消すので、予約した本人がすぐカレンダーを取り直したとき、確実に新しいデータが返る
- **broadcast（WebSocket）はしない**（2026-09-29 決定）。他の人の操作は、フロントが定期取得で拾う（[05](05-frontend-design.md#他の人の操作の反映定期取得)）。R1 の `ReservationUpdated` の broadcast と Reverb は使わない
- `RevalidateFrontendCache` は `Http::withToken(config('services.frontend.revalidate_secret'))->timeout(5)->post(config('services.frontend.internal_url').'/internal/revalidate')`。失敗したらキューのリトライ（3回、間隔を空ける）。それでも失敗したら、時間ベース再検証で最大1時間後に直る

## キャッシュ方針

### カレンダー: 日ごとの「事実」を Redis に1分キャッシュする（2026-09-29 決定）

目的は **カレンダーの DB アクセスを減らすこと**。画面は60秒ごとに取り直すので、キャッシュが無いと DB アクセスが見ている人数に比例して増える。

| 項目 | 内容 |
|---|---|
| 置き場所 | Redis |
| キー | `calendar:day:{Y-m-d}`（日ごと）、`calendar:regular_holidays`（定休日の一覧） |
| 中身（日ごと） | その日の確定済み予約（id・開始・終了・予約者名・`user_id`・料金）と、臨時休業日か（理由つき） |
| 入れないもの | **時間で変わる判定**（過去の枠、予約期間外、`phase`、`is_cancellable`）。読むたびに今の時刻で計算する |
| 期限 | **60秒**（`config('facility.calendar_cache_ttl')`）。画面の定期取得と同じ間隔 |
| 消すタイミング | その日の予約・キャンセル・電話予約・臨時休業日の登録や削除（`ForgetCalendarCache`）。定休日を変えたら定休日のキー |
| 消し方 | commit 直後に、同じリクエストの中で `Cache::forget`（キューに回さない） |
| 保険 | 予約が `slot_taken` で失敗したら、その日のキーを消す |
| 使わない場面 | **予約時の可否の判定**（`ClosedDays` と DB 制約で、必ず DB を見る） |

#### 読み出しの流れ（`CalendarFacts`）

```
1. 期間の日付ぶんのキーを Cache::many でまとめて読む
2. 無かった日だけ、DB から1回のクエリでまとめて読み、Cache::putMany で保存（期限60秒）
3. 定休日のキーも同様
4. CalendarQuery が、事実 + 今の時刻 + BookingRules / DayClosure で枠の状態を決める
```

#### 効果の見積もり

100人が同じ週を見ている場合、Laravel へのリクエストは1分に約100回のまま、**DB へのアクセスは1分に1回程度**（期限切れの後に最初に来た1人だけ）＋書き込みがあった日の分。

#### 時間で変わる判定をキャッシュに入れない理由

「過去の枠」「今日」「予約できる最終日」は予約が無くても時間で変わる。これをキャッシュに入れると、予約が無くても古くなり、毎時・毎日消す仕組みが要る。キャッシュには **書き込みでしか変わらない事実** だけを入れ、時間の判定は読むたびに計算する。これで、キャッシュが古くなる原因は「書き込み」だけになり、書き込み時に消せば正しさを保てる。

#### 承知しているリスク（番号付けはしない。2026-09-29 決定）

- **読み込みと書き込みが重なったとき**: Aさんが DB から読んでからキャッシュに保存するまでの間（数ミリ秒）に、Bさんの予約が commit されてキャッシュが消されると、Aさんの古いデータが保存されて残る。**期限（60秒）で直る**。その間に予約しようとした人は `slot_taken` になり、その時点でキャッシュも消える。二重予約は DB 制約が防ぐので、データは壊れない
- **アプリを通さない DB の変更**（シーダー、手作業の SQL、`model:prune`）: 消す処理を通らないので、最大60秒古い表示が残る。手作業で DB を触った後は `php artisan cache:clear` を流す

R1 の `Cache::tags(['calendar'])`（「月 × 今日の日付 × 権限」のキーで、変更のたびに全部 `flush`）との違い（D7）:

| | R1 | R2 |
|---|---|---|
| キャッシュの単位 | 月 × 今日 × 権限（完成したカレンダー） | 日ごとの事実（時間の判定は入れない） |
| 消し方 | 変更のたびに全部消す。Controller のあちこちで `flush` | 変わった日だけ消す。リスナー1か所 |
| 管理者と会員 | 別のキャッシュ | 同じ事実を使い、返すときに出し分ける |

### ほかのキャッシュ

| 対象 | どこで | 無効化 |
|---|---|---|
| `GET /facility` のトップ表示用 | トップの静的ページ（ISR。タグ `facility`、`revalidate: 3600`） | 設定変更時のオンデマンド再検証 + 1時間の時間ベース再検証 |
| `GET /facility` の計算用 | ブラウザの TanStack Query（`staleTime: Infinity`。トップでは静的 HTML の値を入れ、ブラウザから取り直さない。2026-10-02 決定） | 管理画面で料金・定休日を保存したとき（レスポンスで置き換え）。トップはページを開き直したとき |
| カレンダー・予約一覧 | ブラウザの TanStack Query（カレンダーは取得から60秒間は新しいとみなす） | 60秒ごとの定期取得・自分の操作の成功時。カレンダーは60秒以上たっていればタブに戻ったとき・週を切り替えたときも |

定期取得の通信量は **ETag / 304** でも減らす（[03](03-api.md#カレンダーの-etag--304)）。

### Redis の用途（2026-09-29 決定）

| 用途 | 設定 |
|---|---|
| キャッシュ（カレンダーの事実） | `CACHE_STORE=redis` |
| レート制限（Laravel はキャッシュと同じ置き場所で回数を数える） | 同上 |
| キュー（メール・フロントの再検証） | `QUEUE_CONNECTION=database`（PostgreSQL の `jobs` テーブル） |
| セッション | `SESSION_DRIVER=database`（PostgreSQL の `sessions` テーブル） |

- キューとセッションは PostgreSQL のままにする。流れる量が少なく、Redis に移す理由が無い
- Redis が止まったとき: レート制限（`throttle` ミドルウェア）が回数を数えられず、**API 全体が 500 になる**。**ポートフォリオなので対策はしない**（2026-09-29 決定。過剰なため）。止まったら Railway で再起動する
- レート制限を PostgreSQL に置く案は採らない。リクエストのたびに回数を DB に書くので、カレンダーの DB アクセスを減らす目的とぶつかるため

### 負荷がさらに増えたときの打ち手

1. 定期取得の間隔を延ばす（`CALENDAR_POLL_MS` を 60秒 → 120秒）
2. キャッシュの期限を延ばす（60秒 → 数分。消し損ねたときの古さも延びる）
3. Railway のプラン・台数を増やす（PHP-FPM のワーカー数も合わせて増やす）

## カレンダーの組み立て: `CalendarQuery`

```php
final class CalendarQuery
{
    /** `/calendar` 用。誰が呼んでも同じ @return list<CalendarDay> */
    public function forPublic(CarbonImmutable $from, CarbonImmutable $to): array;

    /** `/admin/calendar` 用。予約の詳細つき @return list<AdminCalendarDay> */
    public function forAdmin(CarbonImmutable $from, CarbonImmutable $to): array;
}
```

日ごとの `closed_reason` の判定順（先に当たったものが優先）:

1. 今日より前 → `past`
2. 予約期間より先（1か月後の翌日以降）→ `out_of_range`
3. 定休日 → `regular_holiday`
4. 臨時休業日 → `holiday`
5. どれでもない → `null`（受付中）

枠（`slots`）の作り方は `/calendar` と `/admin/calendar` で違う。

| | 受付中の日 | 受付外の日（`closed_reason` あり） |
|---|---|---|
| `forPublic` | 各枠 `booked` → `past`（当日の過ぎた時間, B10）→ `available` | `slots: []`（予約の有無も見せない） |
| `forAdmin` | 同じ。`booked` の枠に `reservation_id`、日ごとに `reservations` | **予約がある枠は `booked`、ほかは `closed`**。3か月より前の日だけは `slots: []` |

- 日の判定と枠の判定は2つのメソッドで共通の private メソッドを使う。違うのは受付外の日の扱いと、予約の詳細を含めるかだけ
- 事実は `CalendarFacts`（Redis にキャッシュ）から読む。「過去」「期間外」は `BookingRules`、「定休日・休業日」は `DayClosure` で判定し、予約時の検査と同じルールを使う（カレンダーでは空いて見えるのに予約すると 422、を起こさない）
- **【B11】** R1 は管理者にも受付外の日を `closed` だけで返していた。定休日を後から増やすと、その曜日に残った予約が管理カレンダーに出ず、管理画面からキャンセルできなかった
- 管理者の「3か月より前」は予約の保持期間と同じ。それより前は `model:prune` で消えているので、そもそもデータが無い

戻り値は配列ではなく小さな DTO（`CalendarDay`, `CalendarSlot`）にして、Resource で JSON にする。

## 認可

| 対象 | 方法 |
|---|---|
| 管理者 API | `Gate::define('admin', fn (User $u) => $u->role === UserRole::Admin)` → ルートに `->middleware('can:admin')`。R1 の独自 `AdminMiddleware` は廃止 |
| 会員のキャンセル（`/reservations/{id}/cancel`） | `ReservationPolicy::cancel`: `user_id` が自分のもののみ。**管理者もこのルートでは他人の予約をキャンセルできない** |
| 管理者のキャンセル（`/admin/reservations/{id}/cancel`） | ルートの `can:admin`。全件可。キャンセル理由は `by_admin` |

2つのルートでキャンセル理由（メールの文面）が変わるので、会員用ルートを管理者に開けない。管理者が会員用ルートを使うと理由が `by_member` になってしまうため。

## Controller の例

```php
final class ReservationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return ReservationResource::collection(
            $request->user()->reservations()->upcoming()->get()
        );
    }

    public function store(StoreReservationRequest $request, CreateReservation $action): JsonResponse
    {
        $reservation = $action->forMember($request->user(), $request->timeSlot());

        return ReservationResource::make($reservation)->response()->setStatusCode(201);
    }

    public function cancel(Reservation $reservation, CancelReservation $action): ReservationResource
    {
        $this->authorize('cancel', $reservation);

        return ReservationResource::make($action->handle($reservation, CancellationReason::ByMember));
    }
}
```

## 例外とエラーレスポンス

`bootstrap/app.php` の `withExceptions` で、`api/*` へのリクエストのエラーを [03-api.md のエラー形式](03-api.md#エラー形式) にそろえる（D5）。

| 例外 | ステータス / `code` |
|---|---|
| `ValidationException` | 422 / `validation_failed` |
| `ConflictException` | 409 / 例外が持つ `code`（`slot_taken` など） |
| `AuthenticationException` | 401 / `unauthenticated` |
| `AuthorizationException` / `AccessDeniedHttpException` | 403 / `forbidden` |
| `ModelNotFoundException` / `NotFoundHttpException` | 404 / `not_found` |
| `TokenMismatchException` | 419 / `csrf_token_mismatch` |
| `ThrottleRequestsException` | 429 / `too_many_requests` |
| その他の例外 | 500 / `server_error`。`message` は「サーバーでエラーが発生しました」固定（中身を外に出さない）。詳細はログへ |

業務ルール違反（営業時間外など）は `ValidationException::withMessages(['start_hour' => '...'])` で投げ、フォームの項目エラーと同じ経路にのせる。

プロフィール更新の「現在のパスワード」は Laravel 標準の `current_password` バリデーションルールを使う。これで `current_password` の項目エラーとして返る（R1 は Controller で `Hash::check` して `message` だけを返していた）。

## モデル

- `Reservation`
  - casts: `status => ReservationStatus::class`, `date => 'immutable_date'`, `cancelled_at => 'immutable_datetime'`
  - scopes: `confirmed()`, `upcoming()`, `between($from, $to)`
  - メソッド: `timeSlot(): TimeSlot`, `isCancellable(): bool`, `cancel(): void`
  - `MassPrunable` を使い、`prunable()` で「3か月より前」を返す。スケジューラで `model:prune` を毎日実行（R1 の独自コマンド `reservations:prune-old` を置き換え）
- `Price`: `Price::table(): PriceTable` で2行を値オブジェクトにして返す。行が足りなければ例外（0円の予約を作らない。[02](02-database-design.md#prices)）
- `User`: casts に `role => UserRole::class`。`isAdmin()` は enum を比較
- 一括代入は R1 同様 `#[Fillable]` 属性で許可リストを書く（`$guarded = []` にはしない）。`role` は fillable に含めない（登録 API から admin を作れないように。シーダーでは `forceFill`）

## メール

- Mailable は `ShouldQueue` のまま（R1 と同じ）
- テンプレートは `resources/views/mail/layout.blade.php`（Blade コンポーネント `<x-mail.layout>`）を共通化し、R1 で3ファイルにコピーされていた CSS を1か所にする（D14）
- フッターの施設名・電話番号は `config('facility.*')` から取る
- 件名の施設名も config から取る

## コーディング規約

- 全ファイルに `declare(strict_types=1);`
- 継承されないクラスは `final`、値オブジェクト・DTO は `readonly`
- Pint（`laravel` プリセット）で整形
- Larastan（PHPStan）レベル 6 から始めて、完成時に 8 を目指す
- ログは `LOG_CHANNEL=stderr`（Railway のログ画面で見る）。500 のときは例外の中身をここに出す
- 日本語のエラーメッセージは `lang/ja/validation.php` とアプリの `lang/ja/*.php` に置く（`APP_LOCALE=ja`）。R1 はコード中に日本語メッセージを直書きしていた
