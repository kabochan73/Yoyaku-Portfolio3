import { api } from "@/lib/api-client";
import type { Facility } from "./types";

/*
 * 施設情報の API をブラウザから呼ぶ関数（docs/05 の「features/<機能>/api.ts」）。
 * サーバー（Server Component）からは server.ts の getFacility() を使う。
 */

/**
 * 施設情報を取る（GET /api/facility）。
 *
 * トップページでは呼ばれない（静的な HTML に入っている値を FacilityProvider が先に入れるので、
 * useFacility() は取りに行かない）。FacilityProvider の無いページ（手順7の管理画面）で使う。
 */
export async function fetchFacility(): Promise<Facility> {
  const response = await api.get<{ data: Facility }>("/facility");
  return response.data.data;
}
