import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave, type SaveResult } from "./use-autosave";

type Patch = { title?: string; content?: string };

describe("useAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces edits and saves the merged patch once", async () => {
    const save = vi.fn(async (): Promise<SaveResult> => ({ ok: true }));
    const { result } = renderHook(() => useAutosave<Patch>(save, 500));

    act(() => {
      result.current.schedule({ title: "Draft" });
      result.current.schedule({ content: "a" });
      result.current.schedule({ content: "ab" });
    });
    expect(result.current.status).toBe("unsaved");
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ title: "Draft", content: "ab" });
    expect(result.current.status).toBe("saved");
  });

  it("keeps failed changes and re-sends them on retry", async () => {
    const save = vi
      .fn<(p: Patch) => Promise<SaveResult>>()
      .mockResolvedValueOnce({ ok: false, error: "Network down" })
      .mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useAutosave<Patch>(save, 100));

    act(() => result.current.schedule({ content: "hello" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Network down");

    await act(async () => {
      await result.current.flush();
    });
    expect(save).toHaveBeenLastCalledWith({ content: "hello" });
    expect(result.current.status).toBe("saved");
    expect(result.current.error).toBeNull();
  });

  it("saves edits made during an in-flight save right after it completes", async () => {
    let resolveFirst!: (r: SaveResult) => void;
    const save = vi
      .fn<(p: Patch) => Promise<SaveResult>>()
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useAutosave<Patch>(save, 100));

    act(() => result.current.schedule({ content: "v1" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(result.current.status).toBe("saving");

    act(() => result.current.schedule({ content: "v2" }));
    await act(async () => {
      resolveFirst({ ok: true });
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenNthCalledWith(2, { content: "v2" });
    expect(result.current.status).toBe("saved");
  });
});
