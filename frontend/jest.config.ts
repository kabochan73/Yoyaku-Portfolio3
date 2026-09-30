import type { Config } from "jest";
import nextJest from "next/jest.js";

/*
 * Jest の設定（Next.js 公式の next/jest を使う。node_modules/next/dist/docs の testing/jest.md）。
 * next/jest が、TypeScript・JSX の変換（SWC）、CSS や画像の読み込みの置き換え、
 * next.config.ts と .env の読み込みをまとめて面倒を見てくれる。
 */

/*
 * next/jest は next.config.ts を読み込む。next.config.ts は「API_URL が無ければ止める」ので、
 * テストの実行時にも値が要る。テストでは本物の API に繋がず、通信は MSW で横取りするので、
 * 中身は何でもよい（すでに設定されていればそれを使う）。
 */
process.env.API_URL ??= "http://api.test/api";

/*
 * テストは「日本以外の時刻設定の端末」で動かす。
 * 日付の計算が端末のタイムゾーンに引きずられていないか（フロント版の B1）を、
 * すべてのテストで常に確かめるため。ロサンゼルスは日本と日付がずれやすい（16〜17時間差）。
 * ※ テストの各プロセスはこの設定ファイルの後に起動するので、ここで設定すれば全テストに効く。
 */
process.env.TZ = "America/Los_Angeles";

const createJestConfig = nextJest({
  // next.config.ts と .env を読み込む場所
  dir: "./",
});

const config: Config = {
  /*
   * テストの中でブラウザを真似る環境。素の jsdom には fetch などが無く、
   * MSW（通信の横取り）が動かないので、MSW が推奨する jest-fixed-jsdom を使う。
   */
  testEnvironment: "jest-fixed-jsdom",

  // 各テストファイルの前に読み込む準備（jest-dom の読み込み、MSW の起動・停止）
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  // import の "@/..." を src/ に向ける（tsconfig.json の paths と同じ）
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

/*
 * next/jest が next.config.ts を非同期で読み込むので、この形で書き出す（公式のまま）。
 *
 * 【ESM 専用パッケージの読み込み】
 * MSW v2 が内部で使う rettime などは ESM（import/export）でしか配布されていない。Jest は CommonJS で読み込むので、
 * そのままでは「Must use import to load ES Module」で失敗する。
 * Jest は次の2つがそろうと、ESM を変換なしで直接読み込める（require(esm)）:
 *   1. Node.js 24.9 以上 … このリポジトリは Node 24 を使う（.nvmrc、2026-09-30 決定）
 *   2. Node を --experimental-vm-modules 付きで起動する … ESM を読むための部品
 *      （vm.SourceTextModule）は、この指定が無いと Node 24 でも使えない。
 *      package.json の test スクリプトで NODE_OPTIONS に入れている
 * 起動時に「ExperimentalWarning: VM Modules is an experimental feature」と出るが、害は無い。
 */
export default createJestConfig(config);
