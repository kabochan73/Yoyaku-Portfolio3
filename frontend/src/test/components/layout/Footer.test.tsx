import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/layout/Footer";
import type { Facility } from "@/features/facility/types";
import facilityJson from "@/test/fixtures/facility.json";

/*
 * フッターのテスト。施設情報（D14）とルール（D1）から表示することを確かめる。
 */

const facility: Facility = facilityJson.data;

it("施設名・電話番号・メール・住所を施設情報から出す", () => {
  render(<Footer facility={facility} />);

  expect(screen.getByText("FUTSAL PARK")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "092-123-4567" })).toHaveAttribute(
    "href",
    "tel:092-123-4567",
  );
  expect(
    screen.getByRole("link", { name: "info@futsalpark.example.com" }),
  ).toHaveAttribute("href", "mailto:info@futsalpark.example.com");
  expect(
    screen.getByText("〒000-0000 福岡県福岡市中央区1-2-3"),
  ).toBeInTheDocument();
});

it("受付時間は営業時間のルールから作る（直書きしない）", () => {
  render(
    <Footer
      facility={{
        ...facility,
        rules: { ...facility.rules, open_hour: 9, close_hour: 21 },
      }}
    />,
  );

  expect(screen.getByText("受付時間 9:00 〜 21:00")).toBeInTheDocument();
});
