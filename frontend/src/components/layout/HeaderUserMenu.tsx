"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCurrentUser, useLogout } from "@/features/auth/hooks";

/*
 * ヘッダーの右側（ログイン状態で変わる部分）。docs/05 の「ヘッダーのログイン表示」。
 *
 * ログイン状態はブラウザで取る（GET /api/user）。トップページを静的にするため、
 * サーバーではログイン状態を読まず、静的な HTML にはどちらのボタンも入らない。
 *
 * | 状態         | 表示                         |
 * |--------------|------------------------------|
 * | 読み込み中   | ボタンと同じ大きさのスケルトン |
 * | 未ログイン   | ログイン・新規登録            |
 * | 会員         | マイページ・ログアウト        |
 * | 管理者       | 管理者ページ・ログアウト      |
 */

/** ボタンの見た目のリンク（Button と同じ大きさ・角の丸み） */
const LINK_BASE =
  "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:text-sm";
const PRIMARY_LINK = `${LINK_BASE} bg-green-600 text-white hover:bg-green-700`;
const SECONDARY_LINK = `${LINK_BASE} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`;

export function HeaderUserMenu() {
  const router = useRouter();
  const { data: user, isPending } = useCurrentUser();
  const logoutMutation = useLogout();

  // 読み込み中は、ボタン2つ分と同じ大きさの枠を出す。
  // R1 は何も出さず、ボタンが後から現れてヘッダーがガタついていた
  if (isPending) {
    return (
      <div className="flex items-center gap-2 sm:gap-3" aria-busy="true">
        <Skeleton className="h-8 w-20 rounded-lg sm:h-9 sm:w-24" />
        <Skeleton className="h-8 w-20 rounded-lg sm:h-9 sm:w-24" />
      </div>
    );
  }

  // 未ログイン。取得に失敗したとき（500 など）も、ここに来る（user が undefined）。
  // ヘッダーにエラーを出すほどではないので、未ログインと同じ表示にする
  if (!user) {
    return (
      <nav className="flex items-center gap-2 sm:gap-3">
        <Link href="/login" className={SECONDARY_LINK}>
          ログイン
        </Link>
        <Link href="/register" className={PRIMARY_LINK}>
          新規登録
        </Link>
      </nav>
    );
  }

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      // 成功したらトップへ（マイページなど、ログインが必要なページに残らないようにする）
      onSuccess: () => router.push("/"),
      // 失敗はめったに起きず、ヘッダーにはエラーを出す場所がないので、alert で知らせる
      onError: (error) => window.alert(error.message),
    });
  };

  return (
    <nav className="flex items-center gap-2 sm:gap-3">
      {user.role === "admin" ? (
        <Link href="/admin" className={PRIMARY_LINK}>
          管理者ページ
        </Link>
      ) : (
        <Link href="/mypage" className={PRIMARY_LINK}>
          マイページ
        </Link>
      )}
      <Button
        variant="secondary"
        size="sm"
        className="sm:px-4 sm:text-sm"
        loading={logoutMutation.isPending}
        loadingText="ログアウト中..."
        onClick={handleLogout}
      >
        ログアウト
      </Button>
    </nav>
  );
}
