# Yoyaku-Portfolio2 — プロジェクト概要（R2）

フットサルコート1面の予約サイト「FUTSAL PARK」の作り直し（**R2**）。

- R1 = `../Yoyaku-Portfolio/`（機能は完成。予約・キャンセル・管理画面・リアルタイム反映・メール通知が動く）
- R2 = このリポジトリ

## R2 のゴール

**機能・画面・技術スタックは R1 と同じまま、コードの質を上げる。** 例外として、WebSocket によるリアルタイム反映は定期取得に置き換えて構成を軽くする（2026-09-29 決定）。

新機能は入れない。R1 の仕様（[01-requirements.md](01-requirements.md)）をそのまま引き継ぎ、次の観点で作り直す。

| 観点 | R2 で目指す状態 |
|---|---|
| 正しさ | 同時アクセスでも二重予約が起きない。日付の境界（JST）がずれない。書いてあるルールがサーバーで強制されている |
| 責務の分離 | Controller は薄く、入力検証 = FormRequest、認可 = Policy、業務処理 = Action、副作用 = Event/Listener に分ける |
| 単一の情報源 | 営業時間・利用時間・予約可能期間などのルールを1か所（`config/facility.php`）に置き、フロントは API から受け取る |
| 一貫した API | レスポンスは API Resource で整形し、エラーの形式を統一する |
| フロントの構造 | 機能単位のディレクトリ、API 呼び出し層、`useMutation` によるサーバー状態管理、サーバー側での認可リダイレクト |
| 品質の仕組み | 静的解析（Larastan / tsc strict）、フォーマッタ、CI、境界値を押さえたテスト |

## 想定する規模（2026-09-29 決定）

**大人数での利用は想定しない。仕組みは最小限にする。**

- コート1面の予約サイト。同時にカレンダーを見ているのは多くて数十人程度
- この前提から、次のものは入れない: WebSocket（Reverb）、料金変更のリアルタイム通知
- ただし **カレンダーの DB アクセスは減らす**（2026-09-29 決定）。画面の定期取得（60秒）で DB アクセスが見ている人数に比例して増えないよう、日ごとの予約の事実を Redis に1分キャッシュする（[04](04-backend-design.md#キャッシュ方針)）
- それ以上の打ち手（間隔を延ばす・期限を延ばす・サーバーの増強）は、計測して必要が分かってから

## R1 の課題と R2 での対応

R1 のコードを読んで見つけた課題。R2 の設計判断はすべてこの表に紐づく。

### バグ・仕様との食い違い

| # | R1 の課題 | 影響 | R2 での対応 | 詳細 |
|---|---|---|---|---|
| B1 | `config/app.php` の timezone が `UTC` | 0:00〜9:00(JST) の間は「今日」が前日になる。当日予約の可否や過去日の判定がずれる | `Asia/Tokyo` に設定 | [04](04-backend-design.md#タイムゾーン) |
| B2 | 重複チェック（`exists()`）→ `create()` の間にロックがない | 同じ枠に同時に予約すると両方成功しうる（二重予約） | PostgreSQL の排他制約（`EXCLUDE USING gist`）で DB が保証する | [02](02-database-design.md#reservations) |
| B3 | 「1人1日1件」もアプリ側チェックのみ | B2 と同じく同時リクエストで破れる | 部分ユニークインデックス | [02](02-database-design.md#reservations) |
| B4 | キャンセル済み・過去の予約でもキャンセル API が通る | 二重キャンセルメール、過去の予約が消える | Action で状態遷移を検証（`confirmed` かつ未来のみ） | [04](04-backend-design.md#予約のキャンセル) |
| B5 | フロントの `useCalendar` と `useAdminReservations` がそれぞれ `leaveChannel("calendar")` する | 片方がアンマウントするともう片方もリアルタイム更新が止まる | R2 は WebSocket を使わず定期取得にする（2026-09-29 決定）ので、問題ごと無くなる | [05](05-frontend-design.md#他の人の操作の反映定期取得) |
| B6 | トップの施設情報は1時間ごとの時間ベース再検証のみ。`/api/revalidate` は認証なしの GET で、呼ばれるのはデプロイ時（entrypoint）だけ | 管理画面で料金・定休日を変えても、トップの表示が最大1時間古いまま。誰でも再検証を起こせる | **トップは静的ページ（ISR）で、オンデマンド再検証 + 時間ベース再検証**（2026-09-29 決定）。設定変更時にバックエンドがシークレット付きで再検証を呼ぶ。1時間の時間ベース再検証は保険として残す。ビルド時に API に届かなければビルドを失敗させる（フォールバック値は持たない） | [05](05-frontend-design.md#ページごとの描画方式) |
| B7 | 臨時休業の登録（予約の一括キャンセル＋休業日作成）がトランザクションでない | 途中で失敗すると一部だけキャンセルされる | `DB::transaction` で囲み、メールは commit 後にキュー送信 | [04](04-backend-design.md#臨時休業日の登録) |
| B8 | メールはキュー送信（Mailable が `ShouldQueue`）だが `afterCommit` の指定がない | トランザクション導入後に、ロールバックされた予約のメールが送られうる | リスナー側で `afterCommit` を指定 | [04](04-backend-design.md#副作用eventlistener) |
| B9 | ユーザー削除で予約が `cascadeOnDelete` で消える | 売上・利用実績が消える | `nullOnDelete`（予約は予約者名を保持しているので残せる） | [02](02-database-design.md#reservations) |
| B10 | 当日の予約は「日付が今日以降」しか見ておらず、時刻を見ていない | 15時に「今日の10時〜12時」が予約できる。カレンダーでも過ぎた時間が「空き」に見える | 開始時刻が現在より後であることを検証し、カレンダーでも過ぎた枠は `past`（受付外）で返す | [04](04-backend-design.md#予約の作成) |
| B11 | 管理カレンダーで、受付外の日（定休日・休業日・期間外）は予約の有無に関係なく「受付外」と表示される | 定休日を後から増やすと、その曜日に残った予約が管理画面に出ず、キャンセルもできない | 管理者には受付外の日も予約のある枠を返す | [04](04-backend-design.md#カレンダーの組み立て-calendarquery) |
| B12 | rewrites で中継しているのに、Laravel が中継元を信用する設定（TrustProxies）がない | レート制限を足すと、全ユーザーが Next.js サーバーの IP として数えられる | TrustProxies を内部ネットワークに限定して設定 | [03](03-api.md#クライアントの-ip-をどう取るか) |
| B13 | 「1か月後」の計算がサーバー（`addMonth()`）とフロント（`+31日`）で違う。`addMonth()` は 1/31 → 3/3 のように月末で溢れる | 画面では進めるのに予約すると 422、またはその逆 | サーバーで `addMonthsNoOverflow` で計算し、カレンダー API で `bookable_until` として渡す | [04](04-backend-design.md#予約期間1か月後の定義) |
| B14 | 臨時休業日の一括キャンセルに開始済みの予約も含まれる | R2 で「開始前のみキャンセル可」を入れると、当日の休業登録が失敗する（R2 で新たに生まれる問題を先回り） | 一括キャンセルの対象を開始前の予約に絞る | [04](04-backend-design.md#臨時休業日の登録) |
| B15 | カレンダーの取得に失敗すると全部の枠が「－」（受付外）になる | 「全部埋まっている / 休み」に見え、失敗に気づけない | 取得失敗はエラー表示 + 再読み込み | [08](08-screen-design.md#11-状態の出し方) |
| B16 | 料金・定休日の設定フォームで、読み込み前に保存すると空欄が送られる | 料金が **0円** に、定休日が **全部解除** される | 値が届くまで保存ボタンを出さない | [08](08-screen-design.md#12-フォームの読み込み待ち) |
| B17 | 予約キャンセルのダイアログが、失敗しても閉じる | 管理画面ではエラーが一切見えない | 失敗したらダイアログを開いたまま中に出す | [08](08-screen-design.md#13-ダイアログ) |

### 設計・保守性

| # | R1 の課題 | R2 での対応 |
|---|---|---|
| D1 | 営業時間 10〜22 / 利用時間 2〜4 などが Service・Controller・フロント（`HOURS`, `isValidEnd`, `FacilityInfo` の文字列）に散らばっている | `config/facility.php` に集約し、`GET /api/facility` でフロントへ渡す |
| D2 | 検証・認可・業務ルール・副作用（キャッシュ・メール・broadcast）が Controller に直書き。一般と管理者で同じ処理が重複 | FormRequest / Policy / Action / Event+Listener に分ける |
| D3 | `'confirmed'`, `'admin'`, `'weekday'` などの文字列リテラルがコード中に散在 | PHP の backed enum（`ReservationStatus`, `UserRole`, `PriceType`） |
| D4 | レスポンスがモデルの `toJson` そのまま / 手書き `map` の混在。時刻の表現が `"10:00:00"` と `"10:00"` で揺れる | API Resource で統一 |
| D5 | 業務エラーは `{"message"}` の 422、バリデーションは `{"message","errors"}` の 422、休業日の警告は独自形式の 409、と形式がばらばら | エラー形式を統一する（[03](03-api.md#エラー形式)） |
| D6 | 時刻を `substr($time, 0, 2)` で文字列から切り出している | 予約は「時（整数）」で持つ（`start_hour`, `end_hour`） |
| D7 | カレンダーのキャッシュ（tags + 今日の日付入りキー + 権限別キー）が複雑なわりに、1面・1か月分の集計はもともと軽い | 完成したカレンダーではなく **日ごとの予約の事実** だけを Redis に1分キャッシュし、変わった日だけ書き込み時に消す（時間の判定はキャッシュしない）（[04](04-backend-design.md#キャッシュ方針)） |
| D8 | 料金計算がフロント（`getPricePerHour`）とバックエンドで二重実装 | 料金の正はサーバー。フロントは `/api/facility` の単価で見積もり表示のみ |
| D9 | 管理画面・マイページの認可が `useEffect` でのクライアント側リダイレクト（一瞬描画されうる。中身は `null` だが） | 保護が必要なページ（`/mypage`・`/admin`・ログイン画面）のレイアウトだけ、Server Component で `/api/user` を確認してからリダイレクト。トップを静的に保つため、ルートレイアウトでは確認しない |
| D10 | 送信中・エラーを `useState` で手管理（hook ごとに `submitting` / `submitError` を実装） | TanStack Query の `useMutation` に寄せる |
| D11 | モーダルが `div` 自作で、フォーカス管理や Esc で閉じる処理がない | `<dialog>` ベースの共通 `Dialog` |
| D12 | CI はテスト・型チェック・lint・ビルドを回しているが、PHP の静的解析とフォーマットチェックがない。バックエンドのテストが SQLite（本番は PostgreSQL） | Larastan・Pint を CI に足す。テストは PostgreSQL で実行する（排他制約を検証するため必須） |
| D13 | カレンダーを「月」単位で取得し、月をまたぐ週はフロントで2か月分を `useQueries` で取ってマージしている。管理画面はさらに予約一覧を別に月単位で取る | カレンダー API を「期間（週）」単位にして、1週 = 1リクエストにする。管理カレンダーは予約の詳細も含む `/admin/calendar` 1本にする（`/calendar` は誰が呼んでも同じ内容） |
| D14 | 施設情報（電話番号・住所など）が Hero とメールのフッターで食い違っている（`092-123-4567` と `000-123-4567`）。メールテンプレート3つで CSS をコピペ | 施設情報を `config/facility.php` に置き、メールは共通レイアウトを使う |
| D15 | entrypoint が環境変数 `RUN_ONCE_CMD` の中身を `tinker --execute` で実行する | 任意コード実行の口になるので廃止。一度きりの作業は Railway のワンオフコマンドで行う |
| D16 | API の呼び方がローカル（ブラウザ → `localhost:8000` を直接）と本番（Next.js の rewrites 経由）で違う | どの環境も rewrites 経由の同一オリジン `/api` にそろえる（[05](05-frontend-design.md#ブラウザからは常に同一オリジンの-api-を呼ぶ)） |

## 「やらない」こと

R1 から機能を増やさない。以下は R2 でもスコープ外。

- オンライン決済（現地払いのみ）
- パスワードリセット、メール認証
- 複数コート、繰り返し予約、キャンセル待ち、個人参加
- 退会機能（DB は将来の退会に備えて `nullOnDelete` にしておくだけ）
- キャンセル料（取らない方針。当日キャンセルも可）

## R1 から変わる見た目・操作（2026-09-29 合意）

機能は増やさないが、使い勝手の手直しとして次を変える。詳細は各設計書。

| 変更 | 詳細 |
|---|---|
| 利用規約のキャンセル料の文言を実態に合わせる | [01 §5](01-requirements.md#5-利用規約トップに表示) |
| カレンダーの上に操作の案内を1行出す | [08 §3.3](08-screen-design.md#33-選択中の案内selectionhint) |
| 開始に選んだ枠をもう一度押すと選択解除 | [08 §3.2](08-screen-design.md#32-枠の表示) |
| 予約完了時に「予約しました」とマイページへのリンクを出す | [08 §3.6](08-screen-design.md#36-reservationconfirmdialog) |
| ダイアログを閉じるボタンを「キャンセル」→「戻る」 | [08 §5.3](08-screen-design.md#53-canceldialog) |
| 管理カレンダー: 電話予約に ☎、受付外の日に理由、受付外の日の予約も表示（B11） | [08 §6.1](08-screen-design.md#61-admincalendar) |
| 臨時休業日の削除に確認を挟む。予約がある日の確認ボタンを「予約をキャンセルして休業日にする」に | [08 §6.6](08-screen-design.md#66-holidaymanager) |
| ログアウト後はトップへ移動 | [08 §2](08-screen-design.md#header) |
| 他の人の予約の反映: 数秒（WebSocket）→ 最大60秒（定期取得）。自分の操作はすぐ反映 | [05](05-frontend-design.md#他の人の操作の反映定期取得) |
| 開始済みの予約は「ご利用中 / ご利用済み」と表示し、キャンセルボタンを出さない | [08 §5.2](08-screen-design.md#52-reservationcard) |
| 臨時休業日は今日以降のみ登録でき、一覧も今日以降のみ | [01 §6.4](01-requirements.md#64-臨時休業日) |

## 技術スタック

R1 と同じ。ただし WebSocket（Reverb）はやめ、Redis の用途を変える（2026-09-29 決定）。

| 層 | 技術 |
|---|---|
| フロントエンド | Next.js 16（App Router）/ React 19 / TypeScript / Tailwind CSS v4 / TanStack Query v5 / React Hook Form + Zod |
| バックエンド | Laravel 13 / PHP 8.4 / Sanctum（SPA Cookie 認証） |
| 画面の更新 | TanStack Query の定期取得（60秒）。**R1 の Laravel Reverb + Echo（WebSocket）は使わない**（2026-09-29 決定） |
| DB | PostgreSQL 15 |
| キャッシュ・レート制限 | Redis 7（カレンダーの事実を1分キャッシュ。[04](04-backend-design.md#redis-の用途2026-09-29-決定)） |
| キュー・セッション | PostgreSQL（Laravel の `database` ドライバ） |
| メール | Mailpit（ローカル）/ Resend（本番） |
| テスト | Pest（backend）/ Jest + Testing Library + MSW（frontend） |
| 本番 | Railway（Docker） |

## ドキュメント一覧

| ファイル | 内容 |
|---|---|
| [01-requirements.md](01-requirements.md) | 要件（業務ルール・画面・メール） |
| [02-database-design.md](02-database-design.md) | テーブル定義・制約 |
| [03-api.md](03-api.md) | API 仕様・エラー形式 |
| [04-backend-design.md](04-backend-design.md) | Laravel 側の構成と主要処理 |
| [05-frontend-design.md](05-frontend-design.md) | Next.js 側の構成と主要処理 |
| [06-testing.md](06-testing.md) | テスト方針 |
| [07-dev-and-deploy.md](07-dev-and-deploy.md) | ローカル環境・CI・本番デプロイ |
| [08-screen-design.md](08-screen-design.md) | 画面ごとの部品構成と状態（読み込み中・空・エラー） |
