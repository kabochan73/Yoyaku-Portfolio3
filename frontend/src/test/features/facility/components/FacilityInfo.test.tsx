import { render, screen } from "@testing-library/react";
import { FacilityInfo } from "@/features/facility/components/FacilityInfo";
import type { Facility } from "@/features/facility/types";
import facilityJson from "@/test/fixtures/facility.json";

/*
 * 施設の案内（FacilityInfo）のテスト。
 * 営業時間・料金・定休日・利用時間を、施設情報から作ることを確かめる（D1。直書きしない）。
 */

const facility: Facility = facilityJson.data;

/** 項目名（dt）に対応する値（dd）の文字を返す */
function valueOf(label: string): string | null {
  return screen.getByText(label).nextElementSibling?.textContent ?? null;
}

it("施設情報から、営業時間・料金・定休日・利用時間を出す", () => {
  render(<FacilityInfo facility={facility} />);

  expect(valueOf("営業時間")).toBe("10:00 〜 22:00");
  expect(valueOf("料金（1時間）")).toBe("平日 ¥4,000・土日 ¥5,000");
  expect(valueOf("定休日")).toBe("月曜日");
  expect(valueOf("利用時間")).toBe("2〜4時間");
});

it("施設情報が変われば、表示も変わる", () => {
  render(
    <FacilityInfo
      facility={{
        ...facility,
        rules: {
          ...facility.rules,
          open_hour: 9,
          close_hour: 21,
          min_hours: 1,
          max_hours: 3,
        },
        prices: { weekday: 4500, weekend: 6000 },
        regular_holidays: [1, 4],
      }}
    />,
  );

  expect(valueOf("営業時間")).toBe("9:00 〜 21:00");
  expect(valueOf("料金（1時間）")).toBe("平日 ¥4,500・土日 ¥6,000");
  expect(valueOf("定休日")).toBe("月曜日・木曜日");
  expect(valueOf("利用時間")).toBe("1〜3時間");
});

it("定休日が無ければ「なし」と出す", () => {
  render(<FacilityInfo facility={{ ...facility, regular_holidays: [] }} />);

  expect(valueOf("定休日")).toBe("なし");
});
