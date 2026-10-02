"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { queryKeys } from "@/lib/query-keys";
import type { Facility } from "../types";

/*
 * サーバーで取った施設情報を、ブラウザ側の TanStack Query に先に入れておく部品（docs/05 の「ブラウザ側」）。
 *
 * トップページ（Server Component）で getFacility() の結果を渡して使う:
 *   const facility = await getFacility();
 *   return <FacilityProvider facility={facility}><BookingCalendar /></FacilityProvider>;
 *
 * 中の部品は、この値を Context から直接読まず、必ず useFacility() で読む（値の出どころを1つにする）。
 * 先に入れておくので、useFacility() は GET /api/facility を取りに行かない（hooks.ts の staleTime）。
 *
 * やり方は、ログイン中のユーザーを入れる UserProvider（features/auth）と同じ。
 */

type Props = {
  /** サーバーで取った施設情報（静的な HTML に入る） */
  facility: Facility;
  children: ReactNode;
};

export function FacilityProvider({ facility, children }: Props) {
  const queryClient = useQueryClient();

  // 最初の描画のときに1回だけ入れる（useState の初期値の関数は、最初の1回しか呼ばれない）。
  // useEffect で入れると描画の後になるので、その間に useFacility() が取りに行ってしまう
  useState(() => {
    queryClient.setQueryData(queryKeys.facility, facility);
  });

  return children;
}
