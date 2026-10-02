import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { getFacility } from "@/features/facility/server";
import { Providers } from "./providers";
import "./globals.css";

/*
 * 全ページに共通の骨組み（ルートレイアウト）。docs/05 の「レイアウト・共通」。
 *
 * Server Component のまま、Cookie を読まない（cookies() / headers() / getCurrentUser() を呼ばない）。
 * ここで1回でも読むと、その下の全ページがアクセスごとに描く作りになり、トップページを静的にできなくなる。
 * ログイン状態は、ヘッダーの HeaderUserMenu がブラウザで取る。
 */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * ページの title（docs/08 の 8）。施設名は施設情報から取る（D14。画面・メールと同じ1か所から出す）。
 *
 * - トップなど、title を決めていないページ … "FUTSAL PARK｜屋内フットサルコートの予約"
 * - title を決めたページ（例: "ログイン"）   … "ログイン｜FUTSAL PARK"（下の template の %s に入る）
 *
 * getFacility() の結果は Next.js に保存されている（タグ facility）ので、
 * title のために API への問い合わせが増えることはない。Cookie も読まないので、トップは静的なまま。
 */
export async function generateMetadata(): Promise<Metadata> {
  const facility = await getFacility();

  return {
    title: {
      default: `${facility.name}｜屋内フットサルコートの予約`,
      template: `%s｜${facility.name}`,
    },
    description:
      "フットサルコートの空き状況の確認と、オンライン予約ができます。",
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50">
        {/* TanStack Query などを、Header も含めた全体に行き渡らせる */}
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
