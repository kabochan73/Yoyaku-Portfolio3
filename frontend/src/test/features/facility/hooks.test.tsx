import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { FacilityProvider } from "@/features/facility/components/FacilityProvider";
import { useFacility } from "@/features/facility/hooks";
import type { Facility } from "@/features/facility/types";
import facilityJson from "@/test/fixtures/facility.json";
import { server } from "@/test/msw/server";
import { createTestQueryClient, withQueryClient } from "@/test/render";

/*
 * useFacility と FacilityProvider のテスト。
 * トップページでは、サーバーで取った値を使い、ブラウザから GET /api/facility を呼ばないことを確かめる。
 */

const FACILITY_URL = "http://localhost/api/facility";

const facility: Facility = facilityJson.data;

/** GET /api/facility が呼ばれたかを記録する */
function watchFacilityApi() {
  const calls = { count: 0 };
  server.use(
    http.get(FACILITY_URL, () => {
      calls.count++;
      return HttpResponse.json(facilityJson);
    }),
  );
  return calls;
}

/** useFacility() の営業時間を表示するだけの部品 */
function OpenHour() {
  const { data } = useFacility();
  return <p>{data ? `開始 ${data.rules.open_hour}時` : "なし"}</p>;
}

it("FacilityProvider の中では、渡した施設情報を最初の描画から読め、API を呼ばない", async () => {
  const calls = watchFacilityApi();
  const queryClient = createTestQueryClient();

  render(
    <FacilityProvider facility={facility}>
      <OpenHour />
    </FacilityProvider>,
    { wrapper: withQueryClient(queryClient) },
  );

  expect(screen.getByText("開始 10時")).toBeInTheDocument();

  // タブに戻ったとき（window の focus）も取り直さない
  window.dispatchEvent(new Event("focus"));
  // 取り直しが起きるなら起きる時間を少し待ってから、呼ばれていないことを確かめる
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(calls.count).toBe(0);
});

it("FacilityProvider の無いページでは、GET /api/facility を1回だけ取りに行く", async () => {
  const calls = watchFacilityApi();
  const queryClient = createTestQueryClient();

  const { result, rerender } = renderHook(() => useFacility(), {
    wrapper: withQueryClient(queryClient),
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toEqual(facility);

  // 描き直しても取り直さない
  rerender();
  expect(calls.count).toBe(1);
});
