"use client";

import { useId, useState } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useUserSearch } from "../hooks";
import type { AdminUser } from "../types";

/*
 * 会員検索（docs/08 の 6.7）。管理画面の「ユーザー検索」のアコーディオンの中に出す。
 *
 * | 状態                 | 表示                                                               |
 * |----------------------|--------------------------------------------------------------------|
 * | 未入力               | 「名前またはメールアドレスで検索できます」                         |
 * | 入力中（300ms 待つ） | 何も変えない                                                       |
 * | 検索中               | 前の結果を出したまま薄くする                                       |
 * | 失敗                 | 「検索できませんでした」+「再試行」                                |
 * | 0件                  | 「該当するユーザーはいません」                                     |
 * | あり                 | 名前・メール・予約件数。20件ちょうどなら「上位20件を表示しています…」|
 */

/** 打ち終わってから検索するまでの時間（ミリ秒） */
const SEARCH_DELAY_MS = 300;

export function UserSearch() {
  const [input, setInput] = useState("");
  // 打ち続けている間は変わらない検索語。これが変わったときだけ API を呼ぶ
  const search = useDebouncedValue(input.trim(), SEARCH_DELAY_MS);
  const result = useUserSearch(search);
  const inputId = useId();

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-zinc-700"
        >
          名前またはメールアドレス
        </label>
        <input
          id={inputId}
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-green-600 focus:outline-none"
        />
      </div>

      <SearchResult
        search={search}
        users={result.data?.data}
        limit={result.data?.meta.limit}
        failed={result.isError}
        // 前の結果を出したまま、新しい検索語で探している間
        searching={
          result.isPlaceholderData || (result.isFetching && !result.data)
        }
        onRetry={() => void result.refetch()}
      />
    </div>
  );
}

/** 検索結果（状態ごとの出し分け） */
function SearchResult({
  search,
  users,
  limit,
  failed,
  searching,
  onRetry,
}: {
  search: string;
  users: AdminUser[] | undefined;
  limit: number | undefined;
  failed: boolean;
  searching: boolean;
  onRetry: () => void;
}) {
  if (search === "") {
    return (
      <p className="text-sm text-zinc-500">
        名前またはメールアドレスで検索できます
      </p>
    );
  }

  if (failed) {
    return (
      <ErrorState
        message="検索できませんでした"
        onRetry={onRetry}
        retryLabel="再試行"
      />
    );
  }

  if (!users) {
    // 最初の検索の返事を待っている
    return (
      <p className="text-sm text-zinc-500" aria-busy="true">
        検索中...
      </p>
    );
  }

  if (users.length === 0 && !searching) {
    return <p className="text-sm text-zinc-500">該当するユーザーはいません</p>;
  }

  return (
    <div
      aria-busy={searching}
      className={searching ? "opacity-50 transition-opacity" : ""}
    >
      {limit !== undefined && users.length === limit && (
        <p className="mb-2 text-xs text-zinc-500">
          上位{limit}件を表示しています。条件を絞ってください
        </p>
      )}
      {/* 横に長いので、表の中だけ横にスクロールさせる（docs/08 の 9） */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">
                名前
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                メールアドレス
              </th>
              <th scope="col" className="py-2 font-medium">
                予約件数
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="py-2 pr-4 text-zinc-900">{user.name}</td>
                <td className="py-2 pr-4 text-zinc-700">{user.email}</td>
                <td className="py-2 text-zinc-700">
                  {user.confirmed_reservations_count}件
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
