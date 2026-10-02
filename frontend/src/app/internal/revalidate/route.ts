import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { env } from "@/lib/env";
import { FACILITY_TAG } from "@/features/facility/server";

/*
 * POST /internal/revalidate — 保存してある施設情報を捨てさせる受け口（docs/05 の「再検証の受け口」、B6）。
 *
 * 管理画面で料金・定休日を変えたとき、バックエンド（手順7の RevalidateFrontendCache）がここを呼ぶ。
 * タグ facility の付いた保存（getFacility() の結果）が捨てられ、次のアクセスでトップページが作り直される。
 *
 * - 合言葉（Authorization: Bearer <REVALIDATE_SECRET>）が合わなければ 401。
 *   R1 は GET・認証なしで、誰でも作り直しを起こせた
 * - パスは /api の外。/api/* はバックエンドへの中継（rewrites）に使っているため（next.config.ts）
 * - { expire: 0 }: 次のアクセスで必ず作り直す。既定の "max" は「次のアクセスでは古いページを返し、裏で作り直す」ので、
 *   変更直後の1人目に古い料金が見えてしまう
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return Response.json({ message: "unauthorized" }, { status: 401 });
  }

  revalidateTag(FACILITY_TAG, { expire: 0 });

  return Response.json({ revalidated: true });
}

/**
 * Authorization ヘッダーが「Bearer <REVALIDATE_SECRET>」と一致するか。
 *
 * 文字列を === で比べると、何文字目まで合っていたかで返事の速さがわずかに変わり、
 * 合言葉を1文字ずつ当てられる手がかりになりうる。timingSafeEqual は、どこで違っても同じ時間で比べる。
 */
function isAuthorized(header: string | null): boolean {
  // 合言葉が未設定なら、誰も通さない（"Bearer undefined" などで通ってしまわないように）
  if (!env.REVALIDATE_SECRET || header === null) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${env.REVALIDATE_SECRET}`);
  const actual = Buffer.from(header);

  // 長さが違うと timingSafeEqual は例外を投げるので、先に比べる（長さは秘密ではない）
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
