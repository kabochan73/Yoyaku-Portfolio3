import { http, HttpResponse } from "msw";
import facilityJson from "@/test/fixtures/facility.json";
import { server } from "@/test/msw/server";
import {
  FACILITY_REVALIDATE_SECONDS,
  FACILITY_TAG,
  getFacility,
} from "@/features/facility/server";

/*
 * getFacility()（Server Component 用の施設情報の取得）のテスト。
 *
 * - 呼び先の切り替え（ビルド中は BUILD_API_URL、動いている間は API_URL）
 * - Next.js に保存させる指定（タグ facility・1時間）
 * - 失敗したらエラー（仮の値を使わない）
 * を確かめる。API の返事は MSW で決め、fetch に渡した指定は fetch を見張って確かめる。
 */

// jest.config.ts の API_URL・BUILD_API_URL
const RUNTIME_URL = "http://api.test/api/facility";
const BUILD_URL = "http://build.test/api/facility";

const originalPhase = process.env.NEXT_PHASE;

afterEach(() => {
  process.env.NEXT_PHASE = originalPhase;
  jest.restoreAllMocks();
});

it("動いている間は API_URL を呼び、施設情報を返す", async () => {
  server.use(http.get(RUNTIME_URL, () => HttpResponse.json(facilityJson)));

  await expect(getFacility()).resolves.toEqual(facilityJson.data);
});

it("ビルドの中（NEXT_PHASE が phase-production-build）では BUILD_API_URL を呼ぶ", async () => {
  process.env.NEXT_PHASE = "phase-production-build";
  server.use(http.get(BUILD_URL, () => HttpResponse.json(facilityJson)));

  await expect(getFacility()).resolves.toEqual(facilityJson.data);
});

it("タグ facility と1時間の作り直しを指定して、Next.js に保存させる", async () => {
  server.use(http.get(RUNTIME_URL, () => HttpResponse.json(facilityJson)));
  // 本物の fetch はそのまま動かし（MSW が答える）、渡された指定だけを記録する
  const fetchSpy = jest.spyOn(globalThis, "fetch");

  await getFacility();

  expect(fetchSpy).toHaveBeenCalledWith(
    RUNTIME_URL,
    expect.objectContaining({
      next: { tags: [FACILITY_TAG], revalidate: FACILITY_REVALIDATE_SECONDS },
    }),
  );
  expect(FACILITY_TAG).toBe("facility");
  expect(FACILITY_REVALIDATE_SECONDS).toBe(3600);
});

it("API がエラーを返したら、仮の値を使わずにエラーにする", async () => {
  server.use(
    http.get(RUNTIME_URL, () =>
      HttpResponse.json(
        {
          message: "サーバーでエラーが起きました。",
          code: "server_error",
          errors: {},
        },
        { status: 500 },
      ),
    ),
  );

  await expect(getFacility()).rejects.toThrow("status: 500");
});

it("ビルドの中で BUILD_API_URL が無ければ、分かるメッセージでエラーにする", async () => {
  process.env.NEXT_PHASE = "phase-production-build";
  const saved = process.env.BUILD_API_URL;
  delete process.env.BUILD_API_URL;

  try {
    // 環境変数は読み込んだ時点で確かめるので、BUILD_API_URL を消した状態で読み込み直す
    await jest.isolateModulesAsync(async () => {
      const { getFacility: getFacilityWithoutBuildUrl } =
        await import("@/features/facility/server");
      await expect(getFacilityWithoutBuildUrl()).rejects.toThrow(
        "BUILD_API_URL が設定されていません",
      );
    });
  } finally {
    process.env.BUILD_API_URL = saved;
  }
});
