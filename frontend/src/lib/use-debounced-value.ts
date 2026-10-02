import { useEffect, useState } from "react";

/*
 * 値が変わってから、しばらく変わらなくなったときだけ新しい値を返す hook（デバウンス。docs/05・docs/08 の 6.7）。
 *
 * 検索欄のように、1文字打つたびに API を呼びたくない場面で使う。
 * 打ち続けている間は古い値のまま。最後に打ってから delayMs たったら、新しい値に変わる。
 * R1 は検索の hook の中に、タイマーの処理を直接書いていた。
 *
 * 使い方:
 *   const [search, setSearch] = useState("");
 *   const debouncedSearch = useDebouncedValue(search, 300);   // これを API の検索語に使う
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    // delayMs たったら新しい値にする。その前に value が変わったら、タイマーを止めて数え直す
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
