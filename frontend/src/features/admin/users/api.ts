import { api } from "@/lib/api-client";
import type { UserSearchResponse } from "./types";

/*
 * 会員検索の API（docs/03 の GET /admin/users）。
 */

/** 名前かメールアドレスに search を含む会員（名前の順に最大20人） */
export async function searchUsers(search: string): Promise<UserSearchResponse> {
  const response = await api.get<UserSearchResponse>("/admin/users", {
    params: { search },
  });
  return response.data;
}
