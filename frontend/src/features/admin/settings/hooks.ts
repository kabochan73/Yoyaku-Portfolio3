import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { Facility } from "@/features/facility/types";
import { queryKeys } from "@/lib/query-keys";
import { updatePrices, updateRegularHolidays } from "./api";

/*
 * 施設の設定（料金・定休日）を保存する hook（docs/05 の「更新後に取り直すデータ」）。
 *
 * | 操作               | 取り直すもの                                                         |
 * |--------------------|----------------------------------------------------------------------|
 * | 料金・定休日の更新 | 施設情報（返事で置き換える）・管理者用と公開用のカレンダー（取り直す）|
 *
 * - 施設情報は、API の返事（更新後の施設情報）で置き換える。取り直しの通信が要らない
 * - 定休日が変わると、カレンダーの「受付外」が変わるので、カレンダーは取り直す
 * - トップの静的ページの作り直しは、サーバー側（RevalidateFrontendCache。7-3）が行う
 */

/** 保存できたあとに、施設情報を置き換え、カレンダーを取り直させる */
function applyFacility(queryClient: QueryClient, facility: Facility) {
  queryClient.setQueryData(queryKeys.facility, facility);
  void queryClient.invalidateQueries({
    queryKey: queryKeys.admin.calendar.all,
  });
  void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
}

/** 料金を保存する */
export function useUpdatePrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePrices,
    onSuccess: (facility) => applyFacility(queryClient, facility),
  });
}

/** 定休日を保存する */
export function useUpdateRegularHolidays() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRegularHolidays,
    onSuccess: (facility) => applyFacility(queryClient, facility),
  });
}
