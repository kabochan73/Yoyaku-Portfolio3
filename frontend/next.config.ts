import type { NextConfig } from "next";

/**
 * API（Laravel）の場所。例: Docker 内なら http://nginx/api
 *
 * rewrites() はビルド時に評価され、中継先がビルド結果に焼き込まれる
 * （R1 のコミット f1eda5d で判明）。そのため本番ではビルド引数としても渡す必要がある（docs/05）。
 *
 * R1 は未設定のとき黙って rewrites を無効にしていたので、API がすべて 404 になっても
 * 原因が分かりにくかった。R2 は未設定なら起動・ビルドの時点でエラーにして止める。
 */
const apiUrl = process.env.API_URL;
if (!apiUrl) {
  throw new Error(
    "環境変数 API_URL が設定されていません（例: http://nginx/api）。frontend/.env.example を参照してください。",
  );
}

/** API_URL から末尾の /api を除いたもの（/sanctum の中継先に使う）。例: http://nginx */
const backendOrigin = apiUrl.replace(/\/api\/?$/, "");

const nextConfig: NextConfig = {
  // 本番の Docker イメージを小さくするための出力形式（必要なファイルだけを .next/standalone に集める）
  output: "standalone",

  /**
   * ブラウザからの /api と /sanctum を Laravel へ中継する（D16）。
   *
   * ブラウザから見ると API が Next.js と同じオリジンになるので、
   * - ログインのセッション Cookie がフロントのドメインに付き、
   *   ログインが必要なページの Server Component が cookies() で読める（docs/05 の認証）
   * - CORS の設定が要らない
   * ローカルも本番も、この同じ経路を通る（R1 はローカルだけブラウザが Laravel を直接呼んでいた）。
   *
   * 注意: rewrites は「Next.js にページやファイルが無いパス」にだけ効く。
   * app/api/ の下にルートを作ると、そちらが優先されて中継されなくなるので作らないこと。
   * （バックエンドから呼ばれる再検証の受け口は /internal/revalidate に置く）
   */
  async rewrites() {
    return [
      // 例: /api/calendar?from=... → http://nginx/api/calendar?from=...
      { source: "/api/:path*", destination: `${apiUrl}/:path*` },
      // ログイン前に CSRF Cookie を受け取る Sanctum のエンドポイント（手順4で使う）
      {
        source: "/sanctum/:path*",
        destination: `${backendOrigin}/sanctum/:path*`,
      },
    ];
  },
};

export default nextConfig;
