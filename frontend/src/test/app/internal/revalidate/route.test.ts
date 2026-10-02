/**
 * @jest-environment node
 */
import { revalidateTag } from "next/cache";
import { POST } from "@/app/internal/revalidate/route";

/*
 * POST /internal/revalidate（保存してある施設情報を捨てさせる受け口）のテスト（docs/06）。
 *
 * revalidateTag は Next.js のサーバーの中でしか動かないので、呼ばれ方だけを記録する偽物に差し替える。
 * Request は Node.js 標準のものを使う（上の @jest-environment node。ブラウザを真似る環境は要らない）。
 */

jest.mock("next/cache", () => ({ revalidateTag: jest.fn() }));

// jest.config.ts の REVALIDATE_SECRET
const SECRET = "test-revalidate-secret";

/** 受け口を呼ぶ */
function callRevalidate(authorization?: string): Promise<Response> {
  return POST(
    new Request("http://localhost/internal/revalidate", {
      method: "POST",
      headers: authorization ? { Authorization: authorization } : {},
    }),
  );
}

beforeEach(() => {
  jest.mocked(revalidateTag).mockClear();
});

it("正しい合言葉なら、タグ facility の保存をすぐ捨てさせる（expire: 0）", async () => {
  const response = await callRevalidate(`Bearer ${SECRET}`);

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ revalidated: true });
  expect(revalidateTag).toHaveBeenCalledWith("facility", { expire: 0 });
});

it.each([
  ["合言葉なし", undefined],
  ["違う合言葉", "Bearer wrong-secret"],
  ["長さだけ同じ違う合言葉", `Bearer ${"x".repeat(SECRET.length)}`],
  ["Bearer が無い", SECRET],
])("%s なら 401 で、何も捨てさせない", async (_label, authorization) => {
  const response = await callRevalidate(authorization);

  expect(response.status).toBe(401);
  expect(revalidateTag).not.toHaveBeenCalled();
});

it("サーバーに合言葉が設定されていなければ、誰も通さない", async () => {
  const saved = process.env.REVALIDATE_SECRET;
  delete process.env.REVALIDATE_SECRET;

  try {
    // 環境変数は読み込んだ時点で確かめるので、消した状態で読み込み直す
    await jest.isolateModulesAsync(async () => {
      const { POST: postWithoutSecret } =
        await import("@/app/internal/revalidate/route");
      const response = await postWithoutSecret(
        new Request("http://localhost/internal/revalidate", {
          method: "POST",
          headers: { Authorization: "Bearer undefined" },
        }),
      );

      expect(response.status).toBe(401);
    });
  } finally {
    process.env.REVALIDATE_SECRET = saved;
  }
});
