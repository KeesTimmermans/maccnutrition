import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

const zxingCalls: Array<Record<string, unknown>> = [];
vi.mock("react-zxing", () => ({
  useZxing: (options: Record<string, unknown>) => {
    zxingCalls.push(options);
    return { ref: { current: null }, torch: { isAvailable: false, isOn: false, on: vi.fn(), off: vi.fn() } };
  },
}));
vi.mock("@/lib/i18n", () => ({ useLanguage: () => ({ t: (k: string) => k }) }));

import {
  BarcodeScanner,
  SCANNER_CONSTRAINTS,
  SCANNER_DECODE_INTERVAL_MS,
  SCANNER_HELP_DELAY_MS,
  SCANNER_HINTS,
} from "./BarcodeScanner";

// Minimal render helpers (no testing-library in this project).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root | null = null;
const render = (el: ReactElement) => {
  act(() => {
    if (!root) root = createRoot(container);
    root.render(el);
  });
  return {
    rerender: render,
    unmount: () => {
      act(() => root?.unmount());
      root = null;
    },
  };
};
const queryText = (text: string) =>
  [...container.querySelectorAll("*")].find((el) => el.children.length === 0 && el.textContent === text) ?? null;
const clickButton = (name: string) => {
  const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === name);
  if (!btn) throw new Error(`no button ${name}`);
  act(() => btn.click());
};

describe("BarcodeScanner", () => {
  beforeEach(() => {
    zxingCalls.length = 0;
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
  });
  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container.remove();
    vi.useRealTimers();
  });

  it("restricts formats, tries harder and asks for the back camera at high resolution", () => {
    expect(SCANNER_HINTS.get(DecodeHintType.POSSIBLE_FORMATS)).toEqual([
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ]);
    expect(SCANNER_HINTS.get(DecodeHintType.TRY_HARDER)).toBe(true);
    expect(SCANNER_CONSTRAINTS).toEqual({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
    });
  });

  it("passes the same hints and constraints on every render", () => {
    const { rerender } = render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    rerender(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    expect(zxingCalls.length).toBeGreaterThan(1);
    for (const call of zxingCalls) {
      expect(call.hints).toBe(SCANNER_HINTS);
      expect(call.constraints).toBe(SCANNER_CONSTRAINTS);
      expect(call.timeBetweenDecodingAttempts).toBe(SCANNER_DECODE_INTERVAL_MS);
    }
  });

  it("shows the help banner only after 10 seconds without a barcode", () => {
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    act(() => vi.advanceTimersByTime(SCANNER_HELP_DELAY_MS - 1));
    expect(queryText("barcode_scanner_trouble")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(queryText("barcode_scanner_trouble")).not.toBeNull();
  });

  it("hides the banner after a barcode is detected", () => {
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    const onResult = zxingCalls[zxingCalls.length - 1].onResult as (r: { getText: () => string }) => void;
    act(() => onResult({ getText: () => "5000000000001" }));
    act(() => vi.advanceTimersByTime(SCANNER_HELP_DELAY_MS));
    expect(queryText("barcode_scanner_trouble")).toBeNull();
  });

  it("'Type the number instead' calls onManualEntry, or onClose when it isn't given", () => {
    const onClose = vi.fn();
    const onManualEntry = vi.fn();
    const { unmount } = render(<BarcodeScanner onDetected={vi.fn()} onClose={onClose} onManualEntry={onManualEntry} />);
    act(() => vi.advanceTimersByTime(SCANNER_HELP_DELAY_MS));
    clickButton("barcode_scanner_type_instead");
    expect(onManualEntry).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    unmount();

    // Reopened scanner starts without the banner; MealLogger passes no onManualEntry.
    render(<BarcodeScanner onDetected={vi.fn()} onClose={onClose} />);
    expect(queryText("barcode_scanner_trouble")).toBeNull();
    act(() => vi.advanceTimersByTime(SCANNER_HELP_DELAY_MS));
    clickButton("barcode_scanner_type_instead");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
