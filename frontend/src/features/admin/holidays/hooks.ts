import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { createHoliday, deleteHoliday, fetchHolidays } from "./api";

/*
 * 臨時休業日の hook（docs/05 の「更新後に取り直すデータ」）。
 *
 * | 操作                       | 取り直すもの                                             |
 * |----------------------------|----------------------------------------------------------|
 * | 臨時休業日の登録・削除     | 休業日の一覧・管理者用と公開用のカレンダー               |
 */

/** 今日以降の臨時休業日 */
export function useHolidays() {
  return useQuery({
    queryKey: queryKeys.admin.holidays,
    queryFn: fetchHolidays,
  });
}

/** 登録・削除の後に、一覧とカレンダーを取り直させる */
function invalidateAfterChange(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.admin.holidays });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.admin.calendar.all,
  });
  void queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
}

/** 臨時休業日を登録する */
export function useCreateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createHoliday,
    onSuccess: () => invalidateAfterChange(queryClient),
  });
}

/** 臨時休業日を解除する */
export function useDeleteHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => invalidateAfterChange(queryClient),
  });
}
