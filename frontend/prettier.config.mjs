// Prettier（コードの整形ツール）の設定。
// 書き方（インデント・改行・引用符など）はここで決め、ESLint には口を出させない
// （eslint.config.mjs の eslint-config-prettier）。役割分担: 書き方 = Prettier、バグの元 = ESLint。
//
// 実行: npm run format（整形する） / npm run format:check（チェックだけ。CI で使う）

/** @type {import("prettier").Config} */
const config = {
  // 整形のルールは Prettier の既定のまま（ダブルクォート・セミコロンあり・1行80文字など）。
  // 独自のルールを増やさない方が、誰が書いても同じ形になりやすい。

  plugins: [
    // Tailwind のクラス名の並び順を、公式の推奨順に自動でそろえる。
    // 例: "p-4 flex text-sm" → "flex p-4 text-sm"
    // R1 は同じ見た目でもクラスの順番がばらばらで、見比べにくかった。
    "prettier-plugin-tailwindcss",
  ],

  // Tailwind v4 は設定を CSS に書くので、その CSS の場所をプラグインに教える
  tailwindStylesheet: "./src/app/globals.css",
};

export default config;
