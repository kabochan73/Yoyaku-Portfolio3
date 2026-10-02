import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { searchUsers } from "./api";

/*
 * 会員検索の hook（docs/08 の 6.7）。
 */

/**
 * 検索語で会員を探す。検索語が空なら、API を呼ばない（enabled: false）。
 *
 * - 検索語を変えている間は、前の結果を出したままにする（placeholderData: keepPreviousData）。
 *   画面はそれを見て、前の結果を薄く出す
 * - 1文字打つたびに呼ばないよう、渡す検索語は UserSearch が300ms 待ってから変える（useDebouncedValue）
 *
 * @param search 検索語（前後の空白は落としてから渡す）
 */
export function useUserSearch(search: string) {
  return useQuery({
    queryKey: queryKeys.admin.users(search),
    queryFn: () => searchUsers(search),
    enabled: search !== "",
    placeholderData: keepPreviousData,
  });
}
