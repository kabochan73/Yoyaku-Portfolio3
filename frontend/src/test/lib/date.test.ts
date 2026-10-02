import { addDays, mondayOf, todayInTokyo } from "@/lib/date";

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

describe("addDays", () => {
  it("日数を足す・引く", () => {
    expect(addDays("2026-10-06", 7)).toBe("2026-10-13");
    expect(addDays("2026-10-06", 0)).toBe("2026-10-06");
    expect(addDays("2026-10-05", -1)).toBe("2026-10-04");
  });

  it("月末・年末をまたぐ", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-28", 6)).toBe("2027-01-03");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("うるう年の2月29日を数える", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("端末の夏時間の切り替わり（ロサンゼルス 2026-11-01）でもずれない", () => {
    // テストは夏時間のあるロサンゼルスの時刻設定で動いている（jest.config.ts）
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
  });
});

describe("mondayOf", () => {
  it("その日を含む週（月〜日）の月曜日を返す", () => {
    expect(mondayOf("2026-10-05")).toBe("2026-10-05"); // 月曜 → そのまま
    expect(mondayOf("2026-10-08")).toBe("2026-10-05"); // 木曜
    expect(mondayOf("2026-10-11")).toBe("2026-10-05"); // 日曜 → 前の月曜
    expect(mondayOf("2026-10-12")).toBe("2026-10-12"); // 次の月曜
  });

  it("月・年をまたぐ週", () => {
    expect(mondayOf("2026-11-01")).toBe("2026-10-26"); // 日曜
    expect(mondayOf("2027-01-01")).toBe("2026-12-28"); // 金曜
  });
});
