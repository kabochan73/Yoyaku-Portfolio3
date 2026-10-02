import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchFacility } from "./api";

/*
 * ブラウザで施設情報（営業時間などのルール・料金・定休日）を読む hook（docs/05 の「施設情報とルール」）。
 *
 * カレンダーの枠の数・選べる時間数・見積もりの料金は、ここから読む。
 * R1 は HOURS = 10〜21 や diff < 1 || diff > 3 のように、ルールを部品の中に直接書いていた（D1）。
 */

/**
 * 施設情報。
 *
 * 【ブラウザでは取り直さない（staleTime: Infinity。2026-10-02 決定）】
 * トップページでは、静的な HTML に入っている値を FacilityProvider が先に入れる。
 * 一度入った値は「ずっと新しい」とみなし、ページを開いたとき・タブに戻ったときにも取り直さない。
 * ブラウザから取り直すと、Next.js の保存（ISR）を通らずに Laravel と DB まで届くので、
 * 訪れた人の数だけ DB へのアクセスが増えてしまう（静的ページにした意味が薄れる）。
 *
 * 料金を変えたときは、トップの HTML が作り直される（/internal/revalidate）。
 * 開いたままのタブでは古い見積もりが残ることがあるが、予約の金額はサーバーが計算するので実害は無い（D8）。
 *
 * FacilityProvider の無いページ（手順7の管理画面）では、最初の1回だけ GET /api/facility を取りに行く。
 */
export function useFacility() {
  return useQuery({
    queryKey: queryKeys.facility,
    queryFn: fetchFacility,
    staleTime: Infinity,
  });
}
