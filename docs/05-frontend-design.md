# 05. フロントエンド設計（Next.js）

> Next.js 16 は API や規約に破壊的変更がある（`middleware` → `proxy`、`revalidateTag` の第2引数など）。実装時は `node_modules/next/dist/docs/` を確認すること。

## 方針

1. **機能ごとにまとめる**。R1 は `app/(site)/_hooks`、`app/admin/_hooks`、`src/hooks`、`src/components/calendar` に同じ機能の部品が分かれていた
2. **サーバーの状態は TanStack Query に任せる**。送信中・エラーを `useState` で持たない（D10）
3. **API を呼ぶのは各機能の `api.ts` だけ**。コンポーネントや hook の中に URL を書かない
4. **ルールをハードコードしない**。営業時間・利用時間などは `/api/facility` から受け取る（D1）
5. **日付は `"YYYY-MM-DD"` の文字列で扱う**。`Date` はタイムゾーンでずれるので、生成・計算は `lib/date.ts` に閉じ込める

## ディレクトリ構成

```
frontend/src/
├── app/
│   ├── layout.tsx                  # <html>, Providers, Header（Cookie を読まない）
│   ├── providers.tsx               # QueryClient
│   ├── (site)/
│   │   ├── layout.tsx              # Footer（getFacility。Cookie を読まない）
│   │   ├── page.tsx                # トップ（静的 / ISR）
│   │   └── mypage/
│   │       ├── layout.tsx          # 会員のみ（サーバー側でリダイレクト）
│   │       └── page.tsx
│   ├── (auth)/
│   │   ├── layout.tsx              # ログイン済みならリダイレクト
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── admin/
│   │   ├── layout.tsx              # 管理者のみ
│   │   └── page.tsx
│   ├── error.tsx
│   ├── global-error.tsx
│   ├── internal/revalidate/route.ts  # バックエンドから呼ばれる再検証（シークレット必須）
│   └── not-found.tsx
├── features/
│   ├── auth/
│   │   ├── api.ts                  # login, register, logout, fetchUser, updateProfile
│   │   ├── schemas.ts              # zod
│   │   ├── hooks.ts                # useUser, useLogin, useRegister, useLogout, useUpdateProfile
│   │   ├── server.ts               # getCurrentUser()（Server Component 用）
│   │   └── components/             # LoginForm, RegisterForm, ProfileForm, UserProvider
│   ├── facility/
│   │   ├── server.ts               # getFacility()（Server Component 用。ISR。server-only）
│   │   ├── api.ts                  # fetchFacility()（ブラウザ用）
│   │   ├── hooks.ts                # useFacility()
│   │   ├── types.ts
│   │   └── components/             # Hero, FacilityInfo, RulesSection, FacilityProvider
│   ├── calendar/
│   │   ├── api.ts                  # fetchCalendar(from, to)
│   │   ├── hooks.ts                # useCalendar(week)
│   │   ├── selection.ts            # 枠選択のロジック（純粋関数）
│   │   └── components/             # WeekNavigator, CalendarGrid, SlotCell
│   ├── reservations/               # 会員の予約
│   │   ├── api.ts
│   │   ├── hooks.ts                # useMyReservations, useCreateReservation, useCancelReservation
│   │   └── components/             # BookingCalendar, ReservationConfirmDialog, MyReservationList, CancelDialog
│   └── admin/
│       ├── calendar/               # AdminCalendar, AdminReservationDialog, PhoneReservationDialog
│       ├── prices/
│       ├── regular-holidays/
│       ├── holidays/
│       └── users/
├── components/ui/                  # 機能を知らない部品: Button, Dialog, Accordion, FormField, Skeleton, Alert, ErrorState
├── lib/
│   ├── api-client.ts               # axios インスタンス + ApiError への変換
│   ├── server-fetch.ts             # Server Component からバックエンドを呼ぶ（Cookie 転送）
│   ├── query-keys.ts
│   ├── date.ts                     # 日付の計算（文字列 → 文字列）
│   ├── format.ts                   # 表示用の書式（formatDateJa, formatHourRange, formatYen …。08 §1.4）
│   ├── use-debounced-value.ts
│   ├── query-config.ts             # 定期取得の間隔など
│   └── env.ts                      # 環境変数を zod で検証
└── test/                           # MSW のハンドラ、テスト用 render
```

- 機能どうしの依存は `admin → calendar / reservations → facility / auth` の一方向。逆向きの import はしない
- `components/ui` は機能のコードを import しない

## API 呼び出し層

### ブラウザからは常に同一オリジンの `/api` を呼ぶ

```
ブラウザ ──/api/*, /sanctum/*──▶ Next.js（rewrites）──▶ nginx ──▶ Laravel
         同一オリジン                      API_URL（内部の URL）
```

- R1 は **本番だけ** Next.js の `rewrites` で `/api` と `/sanctum` をバックエンドへ中継し、**ローカルでは** ブラウザが `http://localhost:8000/api` を直接呼んでいた（`NEXT_PUBLIC_API_URL`）。環境ごとに Cookie と CORS の動きが違い、ローカルで動いても本番で動かないことがありえた
- R2 は **ローカルも本番も rewrites** にそろえる。ブラウザから見ると API は同じオリジンなので:
  - セッション Cookie はフロントのドメインに付く → 保護されたページの Server Component が `cookies()` で読んでバックエンドに転送できる（[サーバー側での保護](#サーバー側での保護d9)が成り立つ前提）
  - CORS の設定が要らない（`config/cors.php` の `allowed_origins` を使わない）
  - `NEXT_PUBLIC_API_URL` を削除。`baseURL` は `/api` 固定
- `rewrites()` は **ビルド時に評価される**（R1 のコミット f1eda5d で判明）。本番の Dockerfile では `API_URL` をビルド引数で渡す
- rewrites はファイルシステム上のルートの後に評価されるので、Next.js 側に `app/api/*` のルートを作ると中継されなくなる。**`app/api/` 配下にはルートを作らない**

### `lib/api-client.ts`

```ts
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  withXSRFToken: true,
});

api.interceptors.response.use(undefined, async (error) => {
  // 419（CSRF トークン切れ）は、CSRF Cookie を取り直して1回だけ再送する
  if (isCsrfMismatch(error) && !error.config._retried) {
    await getCsrfCookie();
    return api({ ...error.config, _retried: true });
  }
  return Promise.reject(toApiError(error));
});
```

- R1 は 419 を扱っておらず、タブを長く開いたままだと「予約に失敗しました」になっていた
- ログイン・会員登録の前には `getCsrfCookie()`（`GET /sanctum/csrf-cookie`）を呼ぶ（R1 と同じ）

バックエンドのエラー形式（[03-api.md](03-api.md#エラー形式)）を型にする。

```ts
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string | null,
    readonly fieldErrors: Record<string, string[]>,
    readonly body: unknown,
  ) { super(message); }
}
```

- R1 は各 hook で `error instanceof AxiosError && error.response?.status === 422` を書き、`error.response.data.message` を取り出していた。R2 は `ApiError` だけを見ればよい
- ネットワークエラーなど、形式どおりでないエラーは「通信に失敗しました。時間をおいて再度お試しください。」に変換する

### `features/*/api.ts`

レスポンスの型を持つ関数だけを置く。

```ts
export async function createReservation(input: CreateReservationInput): Promise<Reservation> {
  const { data } = await api.post<{ data: Reservation }>("/reservations", input);
  return data.data;
}
```

### クエリキー

`lib/query-keys.ts` に集める。R1 は `["calendar", month]` などを各所に直書きしていた。

```ts
export const queryKeys = {
  user: ["user"] as const,
  facility: ["facility"] as const,
  calendar: {
    all: ["calendar"] as const,
    week: (from: string) => ["calendar", from] as const,
  },
  myReservations: ["user", "reservations"] as const,
  admin: {
    calendar: {
      all: ["admin", "calendar"] as const,
      week: (from: string) => ["admin", "calendar", from] as const,
    },
    holidays: ["admin", "holidays"] as const,
    users: (search: string) => ["admin", "users", search] as const,
  },
};
```

## ページごとの描画方式

**トップは静的ページ（ISR）にする**（2026-09-29 決定）。みんなが見るページは静的に配り、ログインが必要なページだけアクセスごとに描画する。

| パス | 描画 | 理由 |
|---|---|---|
| `/` | **静的（ISR）**。ビルド時に生成し、オンデマンド + 1時間で作り直す | 全員が見る。施設情報は全員同じ |
| `/login`, `/register` | アクセスごと | ログイン済みならリダイレクトするため Cookie を読む |
| `/mypage` | アクセスごと | 会員のみ |
| `/admin` | アクセスごと | 管理者のみ |
| `not-found` | 静的 | |

- 静的にするため、**ルートレイアウト（`app/layout.tsx`）と `(site)/layout.tsx` では Cookie を読まない**（`cookies()` / `headers()` / `getCurrentUser()` を呼ばない）。1か所でも読むと、その下のページ全部がアクセスごとの描画になる
- カレンダーの空き状況はトップの HTML に含めない。ブラウザで `/api/calendar` を取る（R1 と同じ）
- ビルドの出力で `/` が `○`（Static）/ `Revalidate 1h` になっていることを CI で確かめる（[07](07-dev-and-deploy.md#ci-github-actions)）

## Server Component と Client Component の分け方

### 方針

1. **既定は Server Component（SC）**。`"use client"` は次のどれかが必要な部品にだけ付ける
   - 状態・副作用（`useState`, `useEffect`, `useRef`）
   - TanStack Query / React Hook Form などの hook
   - イベントハンドラ（`onClick`, `onSubmit` など）
   - ブラウザの API（`window`, `<dialog>.showModal()`）
   - Context の提供・読み取り
2. **`"use client"` は境界の部品にだけ書く**。CC から import された部品は自動的に CC になるので、子の部品には書かない
3. **どちらからも使える部品（中立）には何も書かない**。hook もハンドラも持たず、props を表示するだけの部品（`Button`, `Skeleton`, `ReservationSummary` など）。SC からも CC からも使える
4. **SC から CC へ渡す props はシリアライズできる値だけ**（JSON にできる値。関数や Date は渡さない）。日付は文字列のまま渡す（[日付の扱い](#日付の扱い)）
5. **データの取り方で分ける**
   - 全員に同じ・静的でよいデータ（施設情報）と、ページに入る前の認可 → SC で取る
   - ログインユーザーごとのデータ・頻繁に変わるデータ（カレンダー、予約一覧、ヘッダーのユーザー）→ CC で TanStack Query で取る
6. **サーバー専用・ブラウザ専用のファイルに印を付ける**。間違った側から import されたらビルドで失敗させる
   - `import "server-only"`: `features/auth/server.ts`, `lib/server-fetch.ts`, `features/facility/server.ts`（`API_URL` など内部の URL を扱うため）
   - `import "client-only"`: `lib/api-client.ts`（ブラウザの Cookie 前提の axios）

R1 はマイページ・管理画面・ログイン画面のページ全体と `Header` 全体が `"use client"` だった。R2 はページ（`page.tsx`）とレイアウトは常に SC にし、動きのある部分だけを CC として切り出す。

### 振り分け

凡例: **SC** = Server Component / **CC** = Client Component（`"use client"` を書く境界）/ **中立** = 指定なし（呼んだ側に従う）

#### レイアウト・共通

| 部品 | 種類 | 理由 |
|---|---|---|
| `app/layout.tsx` | SC | `<html>` と骨組みだけ。Cookie を読まない（トップを静的に保つ） |
| `app/providers.tsx` | CC | QueryClient を持つ |
| `Header` | SC | ロゴ・リンクなど動かない部分 |
| └ `HeaderUserMenu` | CC | `useUser()` でログイン状態を取り、ログアウトを実行する。R1 は `Header` 全体が CC だった |
| `app/(site)/layout.tsx` | SC | `getFacility()` で Footer 用の施設情報を取る |
| `Footer` | SC | 施設情報を表示するだけ |
| `app/(auth)/layout.tsx`, `mypage/layout.tsx`, `admin/layout.tsx` | SC | `getCurrentUser()` で判定して `redirect()` |
| `UserProvider` | CC | サーバーで取ったユーザーを `useUser()` の初期値にする |
| `app/error.tsx`, `app/global-error.tsx` | CC | Next.js の決まりで CC（`reset()` を受け取る） |
| `app/not-found.tsx` | SC | |

#### トップ（`/`）

| 部品 | 種類 | 理由 |
|---|---|---|
| `page.tsx` | SC | `getFacility()`（ISR）。静的 HTML を作る |
| `FacilityProvider` | CC | 施設情報を `useFacility()` の初期値として渡す |
| `Hero`, `FacilityInfo`, `RulesSection` | SC | 表示だけ。静的 HTML に入る |
| `BookingCalendar` | CC | カレンダーの取得・枠選択の状態・予約の送信 |
| └ `WeekNavigator`, `CalendarGrid`, `SlotCell`, `SelectionHint`, `ReservationConfirmDialog` | （CC の子） | `BookingCalendar` から import されるので自動的に CC。`"use client"` は書かない |

#### ログイン・会員登録

| 部品 | 種類 | 理由 |
|---|---|---|
| `login/page.tsx`, `register/page.tsx` | SC | ページタイトル（`metadata`）と骨組み |
| `LoginForm`, `RegisterForm` | CC | React Hook Form・送信 |

#### マイページ

| 部品 | 種類 | 理由 |
|---|---|---|
| `page.tsx` | SC | 骨組み |
| `MyReservationList` | CC | TanStack Query（タブに戻ったとき・操作後に取り直すため、サーバーでは取らない） |
| └ `ReservationCard`, `CancelDialog` | （CC の子） | |
| `Accordion` | CC | 開いたときに初めて中身を描画する（中の部品のデータ取得を遅らせる） |
| `ProfileForm` | CC | React Hook Form・送信 |

#### 管理画面

| 部品 | 種類 | 理由 |
|---|---|---|
| `page.tsx` | SC | 骨組み |
| `AdminCalendar` | CC | `/admin/calendar` の取得・選択・電話予約・キャンセル |
| └ `AdminReservationDialog`, `PhoneReservationDialog` | （CC の子） | |
| `PriceForm`, `RegularHolidayForm`, `HolidayManager`, `UserSearch`, `ProfileForm` | CC | 取得・フォーム・送信 |

#### 共通 UI 部品（`components/ui/`）

| 部品 | 種類 | 理由 |
|---|---|---|
| `Button`, `Skeleton`, `Alert`, `FormField` | 中立 | 表示だけ。`onClick` は呼んだ側（CC）が渡す |
| `ErrorState` | 中立 | 「再読み込み」の `onRetry` は呼んだ側（CC）が渡す |
| `Dialog` | CC | `ref` と `showModal()`、Esc の制御 |
| `Accordion` | CC | 開閉の状態 |
| `ReservationSummary` | 中立 | 表示だけ |

### 決めたこと（2026-09-29）

- **マイページの予約一覧はサーバーで取らない**。サーバーで取って初期値にするとスケルトンは出なくなるが、タブに戻ったとき・操作後の取り直しはどのみちクライアントで行うので、取り方が2通りになる。一覧は短く、スケルトンは一瞬なので、取り方を1通り（CC + TanStack Query）にそろえる
- ページ（`page.tsx`）とレイアウトには `"use client"` を書かない。ESLint のルールか CI のスクリプトで `app/**/page.tsx` と `app/**/layout.tsx` に `"use client"` が無いことを確かめる

## 認証とページの保護

### ヘッダーのログイン表示

ルートレイアウトで Cookie を読まないので、ヘッダーのユーザー情報は **ブラウザで取る**（R1 と同じ `useUser()` → `GET /api/user`）。

- 読み込み中はボタンと同じ大きさの枠（スケルトン）を出し、表示されたときにレイアウトがずれないようにする
  - R1 は読み込み中に何も出さず（`isLoading ? null : ...`）、ボタンが後から現れてヘッダーがガタついていた
- 静的な HTML には「ログイン / 新規登録」も「マイページ / ログアウト」も入らない。どちらになるかはブラウザで決まる

### サーバー側での保護（D9）

R1 はページを `"use client"` にして、`useEffect` の中で未ログインなら `router.replace` していた。R2 は **保護が必要なページのレイアウトだけ** Server Component で判定してから描画する。

```tsx
// app/admin/layout.tsx
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return <UserProvider initialUser={user}><main>{children}</main></UserProvider>;
}
```

| レイアウト | 判定 |
|---|---|
| `app/admin/layout.tsx` | 未ログイン → `/login`、会員 → `/` |
| `app/(site)/mypage/layout.tsx` | 未ログイン → `/login`、管理者 → `/admin`（R1 と同じく管理者はマイページを使わない） |
| `app/(auth)/layout.tsx` | ログイン済み → 管理者は `/admin`、会員は `/` |

`getCurrentUser()`（`features/auth/server.ts`）は、ブラウザから来た Cookie をそのままバックエンドの `GET /api/user` に転送する。

```ts
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const res = await serverFetch("/user");   // cookies() を Cookie ヘッダーに、Referer に FRONTEND_URL を付ける
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(...);
  return (await res.json()).data;
});
```

- Sanctum は `Referer` / `Origin` が `SANCTUM_STATEFUL_DOMAINS` に含まれるときだけ Cookie セッションを見るので、`Referer` を付ける
- `cache()` で1リクエスト内の重複呼び出しをまとめる
- 保護されたページでは、取れたユーザーを `UserProvider` で `useUser()` の `initialData` にする。ヘッダーもこのページではスケルトンを出さずに済む
- **レイアウトでの判定は画面の出し分けのためで、守りではない**。守りは API 側の `auth:sanctum` と `can:admin`。レイアウトはクライアント側の画面遷移では再実行されないことがあるので、これに頼らない

### セッション切れ

`api-client` のインターセプタで 401 を受けたら `queryKeys.user` を `null` にする。保護されたページにいた場合はログイン画面へ移動する。

## 施設情報とルール

```tsx
// app/(site)/page.tsx（Server Component。Cookie を読まないので静的になる）
export default async function Home() {
  const facility = await getFacility();   // fetch(..., { next: { tags: ["facility"], revalidate: 3600 } })
  return (
    <FacilityProvider value={facility}>
      <Hero />
      <FacilityInfo />
      <BookingCalendar />
      <RulesSection />
    </FacilityProvider>
  );
}
```

### 再検証: オンデマンド + 時間ベース

**オンデマンド再検証 + 時間ベース再検証**（2026-09-29 決定、B6）。

| 再検証 | いつ | 役割 |
|---|---|---|
| オンデマンド | 管理画面で料金・定休日を変えたとき、バックエンドが `POST /internal/revalidate` を呼ぶ | 変更を **すぐ** トップに反映する（本命） |
| 時間ベース（3600秒） | 最後の生成から1時間後のアクセス | オンデマンドの呼び出しが失敗したとき、シーダーなど管理画面を通さずに DB を変えたときの **保険**。R1 の「起動時に再検証を叩くスクリプト」はこれで不要になる |

- 再生成のときに API が落ちていたら、Next.js は **前回のページを出し続ける**（エラーページに差し替わらない）。次のアクセスで再度作り直しを試みる

#### 再検証の受け口

```ts
// app/internal/revalidate/route.ts
export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${env.REVALIDATE_SECRET}`) {
    return Response.json({ message: "unauthorized" }, { status: 401 });
  }
  revalidateTag("facility", { expire: 0 });  // 次のアクセスで必ず作り直す
  return Response.json({ revalidated: true });
}
```

- R1 は GET・認証なし。R2 はシークレット付きの POST
- パスは `/api` の外（`/internal`）。`/api/*` はバックエンドへの rewrites に使っているため（[上記](#ブラウザからは常に同一オリジンの-api-を呼ぶ)）
- `{ expire: 0 }` にする理由: `"max"` は「次のアクセスでは古いページを返し、裏で作り直す」ので、変更直後の1人目に古い料金が見える。料金は古い値を出したくない
- `updateTag` は Server Action 専用なので使えない（Route Handler からは `revalidateTag`）

#### ブラウザ側

- クライアントでは `useFacility()`（TanStack Query。静的 HTML に入っている値を `initialData` にする）で施設情報を読む
- `FacilityProvider` の役割は、サーバーで取った値を `useFacility()` の `initialData` として渡すことだけ。クライアントの部品は Context を直接読まず、必ず `useFacility()` を使う（値の出どころを1つにする）
- **料金・定休日の変更はリアルタイムでは伝えない**（2026-09-29 決定）。変更前から開いていたタブでは、確認ダイアログの見積もり料金が古いことがある
  - 実害は小さい: 予約の金額はサーバーが計算して保存し、完了時の表示と確認メールはその金額を使う。料金の変更自体もまれ
  - TanStack Query の既定で、タブに戻ったときなどに取り直されるので、古いままの時間も短い
- 予約完了後に表示する金額は、サーバーのレスポンスの `price` を使う（D8）
- R1 の `HOURS = 10〜21` や `diff < 1 || diff > 3` のような直書きは、`useFacility().rules` に置き換える

### ビルド時の API

静的ページなので、**`next build` の中で `/api/facility` を呼ぶ**。

| 場面 | `getFacility()` の呼び先 |
|---|---|
| `next build`（`NEXT_PHASE === "phase-production-build"`） | `BUILD_API_URL`（ビルド環境から届く URL。本番はバックエンドの公開 URL、CI はスタブサーバー） |
| 実行時の再生成 | `API_URL`（内部の URL） |

- R1 はビルド時に API に届かないとフォールバック値（4000円など）を焼き込み、frontend・backend 両方の entrypoint で起動時に `/api/revalidate` を叩いて直していた
- R2 は **フォールバック値を持たない。API に届かなければビルドを失敗させる**。間違った料金の静的ページを配るより、デプロイが止まって気づける方がよい
- そのため、本番はバックエンドを先にデプロイしてから frontend をビルドする。CI はスタブサーバーを立ててからビルドする（[07](07-dev-and-deploy.md)）

## 週間カレンダー

### 取得

- **カレンダーは ISR にしない・サーバーでキャッシュしない**。トップの静的 HTML に入るのは枠組み（見出しとスケルトン）だけで、空き状況はブラウザが取る。Next.js（rewrites）も Laravel（D7）もキャッシュせず、キャッシュはブラウザの TanStack Query（週ごと）だけ。空き状況は予約のたび・時刻の経過で変わるため
- `useCalendar(weekStart)` → `GET /api/calendar?from=月曜&to=日曜`。**1週間 = 1リクエスト**（D13）
  - R1 は月単位で取っていたので、月をまたぐ週では2か月分を `useQueries` で取ってマージし、「両方揃うまでローディング」の特別扱いが必要だった
- 次の週を先読みする（`queryClient.prefetchQuery`）
- 週送りの上限は、レスポンスの `meta.bookable_until` を含む週まで。R1 はフロントで `today + 31日` を計算していた（B13）
- 最初に表示する週は `todayInTokyo()` の週。カレンダーのデータが届いたら、以降の「今日」は `meta.today` を使う

### 枠選択のロジックを純粋関数にする

R1 は `WeeklyCalendar` と `AdminCalendar` の両方に `isValidEnd` と `handleSlotClick` がほぼ同じ内容でコピーされていた。R2 は `features/calendar/selection.ts` に1つだけ置く。

```ts
type Selection =
  | { kind: "idle" }
  | { kind: "start"; date: string; hour: number }
  | { kind: "complete"; date: string; startHour: number; endHour: number };

export function selectSlot(
  current: Selection,
  clicked: { date: string; hour: number },
  getStatus: (date: string, hour: number) => SlotStatus,
  rules: Pick<BookingRules, "minHours" | "maxHours">,
): Selection;

export function canBeEnd(current: Selection, target: { date: string; hour: number }, ...): boolean;
```

- React に依存しないので、Jest で境界値（2時間ちょうど、4時間ちょうど、間に予約済みがある、日をまたぐ）を直接テストできる
- 会員用 `BookingCalendar` と管理者用 `AdminCalendar` は、この関数と共通の `CalendarGrid` を使い、「選び終わったら何をするか」だけが違う

### 更新後に取り直すデータ

更新系の操作が成功したら、影響するクエリを無効化する。**どの操作が何を取り直すかをこの表に集約** し、各 hook の `onSuccess` はこれに従う。

| 操作 | 無効化するキー |
|---|---|
| 予約（会員） | `calendar.all`, `myReservations` |
| キャンセル（会員） | `calendar.all`, `myReservations` |
| 電話予約・キャンセル（管理者） | `admin.calendar.all`, `calendar.all` |
| 臨時休業日の登録・削除 | `admin.holidays`, `admin.calendar.all`, `calendar.all` |
| 料金・定休日の更新 | `facility`（レスポンスで置き換え）, `admin.calendar.all`, `calendar.all` |
| プロフィール更新 | `user`（レスポンスで置き換え） |
| `409 slot_taken` / `reservation_not_cancellable` | そのとき表示している一覧・カレンダー |

他の人の操作による変化は、[定期取得](#他の人の操作の反映定期取得) で拾う。

### 予約の送信

```ts
export function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReservation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.myReservations });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "slot_taken") {
        queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });  // 最新の空き状況を見せる
      }
    },
  });
}
```

## 他の人の操作の反映（定期取得）

**WebSocket（Reverb + Echo）はやめ、TanStack Query の定期取得にする**（2026-09-29 決定）。このアプリはコート1面・利用者も多くなく、「見ている間に枠が埋まる」ことはまれ。埋まっていても、予約時に `409 slot_taken` で気づける（二重予約は DB が防ぐ）。数秒の即時性のために WebSocket サーバーを1つ運用するのは割に合わない。

| データ | 取り直すタイミング |
|---|---|
| カレンダー（`/calendar`, `/admin/calendar`） | **表示している間 60秒ごと**（`refetchInterval`）+ タブに戻ったとき・週を切り替えたとき（前回の取得から60秒以上たっていれば。`staleTime`）+ 自分の操作の成功時（必ず） |
| マイページの予約一覧 | タブに戻ったとき（既定の `staleTime: 0` なので毎回）+ 自分の操作の成功時（定期取得はしない） |
| ヘッダーのユーザー・施設情報 | TanStack Query の既定（タブに戻ったときなど） |

```ts
export function useCalendar(weekStart: string) {
  return useQuery({
    queryKey: queryKeys.calendar.week(weekStart),
    queryFn: () => fetchCalendar(weekStart, addDays(weekStart, 6)),
    staleTime: CALENDAR_FRESH_MS,        // 60秒。取ってから60秒間は新しいとみなし、週の行き来やタブの切り替えでは取り直さない
    refetchInterval: CALENDAR_POLL_MS,   // 60秒。表示している間だけ。タブが裏にあるときは止まる（既定）
    placeholderData: keepPreviousData,
  });
}
```

- 間隔は `lib/query-config.ts` に定数で置く: `CALENDAR_POLL_MS = 60_000`（定期取得）、`CALENDAR_FRESH_MS = 60_000`（新しいとみなす時間）
- **`staleTime: 60秒`**（2026-09-29 決定）: 同じ週を60秒以内に見直したとき（週を行き来した、タブを切り替えて戻った）は、手元のデータをそのまま使い DB にアクセスしない。60秒を過ぎていれば取り直す
- 定期取得（`refetchInterval`）は `staleTime` に関係なく60秒ごとに必ず取り直す。つまり他の人の予約は、どの操作をしていても最大60秒で反映される
- 自分の予約・キャンセルの後は、`invalidateQueries` で「古い」と印を付けるので、`staleTime` に関係なくすぐ取り直す（自分の操作が反映されないことはない）
- タブが裏にあるときは定期取得しない（`refetchIntervalInBackground` の既定が `false`）
- **【B5】** R1 の「2つの hook がそれぞれ `leaveChannel` して購読が切れる」問題は、WebSocket を使わないので無くなる
- 取り直しで枠の状態が変わっても、枠選択は壊れない（[08 §3.4](08-screen-design.md#34-選択中にデータが変わったとき)）

## フォーム

- React Hook Form + zod（R1 と同じ）
- zod のスキーマは `features/*/schemas.ts` に置き、型は `z.infer` で作る
- サーバーの 422 は `applyServerErrors(form.setError, apiError)` で項目ごとのエラーに反映する。項目に当てはまらないものはフォーム上部に出す

## UI 部品

| 部品 | R1 の課題 | R2 |
|---|---|---|
| `Dialog` | モーダルごとに `div.fixed` を自作。フォーカス移動・Esc・背景スクロールの制御がない（D11） | ネイティブの `<dialog>` + `showModal()`。開いたら最初の操作できる要素（入力欄があればそこ）にフォーカス、閉じたら元の場所に戻す。送信中は閉じられない（[08 §1.3](08-screen-design.md#13-ダイアログ)） |
| `SlotCell` | `<td onClick>` でキーボード操作できない | セル内に `<button>`。`aria-label="10月6日（火）12:00〜13:00 空き"`、選択中は `aria-pressed`。押せない枠は `disabled` |
| `Button` | 同じ Tailwind クラスを各所にコピー | `variant`（primary / secondary / danger）と `size` を持つ部品 |
| `Accordion` | 自作 | `<details>` / `<summary>` |
| `Alert` / `Skeleton` / `ErrorState` | スピナーやエラー表示を各ページにコピー。取得失敗の表示が無い画面もあった | 共通化。`ErrorState` は「エラー文 + 再読み込みボタン」（[08 §1.1](08-screen-design.md#11-状態の出し方)） |

## 日付の扱い

- サーバーとのやりとりは `"YYYY-MM-DD"` と「時（整数）」のみ
- 「今日」はブラウザのタイムゾーンではなく **日本時間** で求める: `todayInTokyo()`（`Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" })`）。海外や時刻設定のずれた端末でも週の表示がずれない
- `lib/date.ts`（計算）の関数はすべて文字列を受け取り文字列を返す（`addDays("2026-10-06", 7)`, `mondayOf(date)`）
- 表示用の書式は `lib/format.ts` に分ける（`formatDateJa`, `formatWeekRange`, `formatHourRange`, `formatYen`）
- R1 の `formatDateLabel` はマイページ・管理画面の各モーダルにコピーされていた。`formatDateJa` 1つにする

## 環境変数

`lib/env.ts` で zod を使って起動時に検証する。足りなければ起動時に落ちる。

| 変数 | 使う場所 |
|---|---|
| `API_URL` | rewrites の中継先・実行時のサーバー側 fetch（内部の URL。rewrites に焼き込むため **ビルド時にも値が必要**。届く必要はない） |
| `BUILD_API_URL` | ビルド時に `/facility` を取る先（ビルド環境から **届く** URL） |
| `FRONTEND_URL` | `getCurrentUser()` の `Referer` |
| `REVALIDATE_SECRET` | `/internal/revalidate` の認証 |

## コーディング規約

- TypeScript `strict: true`、`noUncheckedIndexedAccess: true`
- `any` を使わない。API のレスポンスは型を付ける（R1 は `slots: Record<string, string>` を `as SlotStatus` でキャストしていた）
- `"use client"` は必要な葉のコンポーネントにだけ付ける。ページ全体を client にしない
- ESLint（`eslint-config-next`）+ Prettier（`prettier-plugin-tailwindcss` でクラス順をそろえる）
