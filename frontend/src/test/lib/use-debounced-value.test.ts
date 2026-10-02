import { act, renderHook } from "@testing-library/react";
import { useDebouncedValue } from "@/lib/use-debounced-value";

/*
 * useDebouncedValue（値が落ち着いてから新しい値を返す）のテスト。
 */

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it("値が変わっても、300ms たつまでは古い値を返す", () => {
  const { result, rerender } = renderHook(
    ({ value }) => useDebouncedValue(value, 300),
    {
      initialProps: { value: "" },
    },
  );

  rerender({ value: "山" });
  act(() => jest.advanceTimersByTime(299));
  expect(result.current).toBe("");

  act(() => jest.advanceTimersByTime(1));
  expect(result.current).toBe("山");
});

it("続けて変わると、最後に変わってから数え直す（途中の値は返さない）", () => {
  const { result, rerender } = renderHook(
    ({ value }) => useDebouncedValue(value, 300),
    {
      initialProps: { value: "" },
    },
  );

  rerender({ value: "山" });
  act(() => jest.advanceTimersByTime(200));
  rerender({ value: "山田" });
  act(() => jest.advanceTimersByTime(200));

  // 「山」から 400ms たっているが、「山田」からはまだ 200ms
  expect(result.current).toBe("");

  act(() => jest.advanceTimersByTime(100));
  expect(result.current).toBe("山田");
});
