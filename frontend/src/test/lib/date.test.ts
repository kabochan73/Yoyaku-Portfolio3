import { todayInTokyo } from "@/lib/date";

/*
 * フロント版の B1: 端末のタイムゾーンに関係なく、日本の日付を返すこと。
 *
 * テストはロサンゼルスの端末のつもりで動いている（jest.config.ts で TZ=America/Los_Angeles）。
 * 日本時間 2026-10-06 08:00 = UTC 2026-10-05 23:00 = ロサンゼルス 2026-10-05 16:00。
 * 日本ではもう 10/6 だが、ロサンゼルスではまだ 10/5 という「日付がずれる時間帯」で確かめる。
 */
describe("todayInTokyo", () => {
  const tokyoMorning = new Date("2026-10-05T23:00:00Z"); // 日本時間 10/6 08:00

  afterEach(() => {
    jest.useRealTimers();
  });

  it("テストが日本以外のタイムゾーンで動いていることの確認（前提）", () => {
    // 端末（ロサンゼルス）の日付ではまだ 5日。これが 5 でなければ、下のテストは意味をなさない
    expect(tokyoMorning.getDate()).toBe(5);
  });

  it("B1: 端末ではまだ前日でも、日本の日付を返す", () => {
    expect(todayInTokyo(tokyoMorning)).toBe("2026-10-06");
  });

  it("引数を省略すると、現在時刻を使う", () => {
    // 現在時刻を固定して確かめる
    jest.useFakeTimers().setSystemTime(tokyoMorning);

    expect(todayInTokyo()).toBe("2026-10-06");
  });

  it("日本時間の日付の変わり目（23:59 と 0:00）", () => {
    // 日本時間 10/6 23:59 = UTC 10/6 14:59
    expect(todayInTokyo(new Date("2026-10-06T14:59:00Z"))).toBe("2026-10-06");
    // 日本時間 10/7 00:00 = UTC 10/6 15:00
    expect(todayInTokyo(new Date("2026-10-06T15:00:00Z"))).toBe("2026-10-07");
  });

  it("月・年の変わり目でも、0 埋めの YYYY-MM-DD で返す", () => {
    // 日本時間 2027-01-01 00:00 = UTC 2026-12-31 15:00
    expect(todayInTokyo(new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });
});
