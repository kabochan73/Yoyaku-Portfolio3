import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ---------------------------------------------------------------------------
  // R2 のルール: ページとレイアウトに "use client" を書かない
  // ---------------------------------------------------------------------------
  // ページ（page.tsx）とレイアウト（layout.tsx）は常に Server Component にし、
  // 動きのある部分だけを Client Component として切り出す（docs/05 の
  // 「Server Component と Client Component の分け方」）。
  // R1 はマイページ・管理画面などのページ全体を "use client" にしていた。
  // トップのレイアウトに "use client" や Cookie の読み取りが入ると、トップが静的でなくなる事故にも繋がる。
  {
    files: ["src/app/**/page.tsx", "src/app/**/layout.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // ファイル先頭の "use client"（ディレクティブ）を見つける書き方
          selector: "Program > ExpressionStatement[directive='use client']",
          message:
            'page.tsx / layout.tsx には "use client" を書かない。動きのある部分を別の Client Component に切り出す（docs/05）。',
        },
      ],
    },
  },

  // Prettier とぶつかる「書き方」のルールを止める。必ず最後に置く（後に置いたものが優先されるため）
  prettier,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
