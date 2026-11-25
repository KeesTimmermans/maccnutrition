import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

// Mocked detector: each detect() call returns the next queued value (or nothing).
const reads: Array<string | null> = [];
const detect = vi.fn(async () => {
  const v = reads.length ? reads.shift() : null;
  return v ? [{ rawValue: v, format: "ean_13" }] : [];
});
vi.mock("@/lib/barcodeDetection", async (orig) => {
  const real = await orig<typeof import("@/lib/barcodeDetection")>();
  return { ...real, getBarcodeDetector: vi.fn(async () => ({ detect })) };
});
vi.mock("@/lib/i18n", () => ({ useLanguage: () => ({ t: (k: string) => k }) }));

import {
  BarcodeScanner,
  SCANNER_CONSTRAINTS,
  SCANNER_DECODE_INTERVAL_MS,
  SCANNER_HELP_DELAY_MS,
  SCANNER_FORMATS,
} from "./BarcodeScanner";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root | null = null;
const render = (el: ReactElement) => {
  act(() => {
    if (!root) root = createRoot(container);
    root.render(el);
  });
  return { unmount: () => { act(() => root?.unmount()); root = null; } };
};
const queryText = (text: string) =>
  [...container.querySelectorAll("*")].find((el) => el.children.length === 0 && el.textContent === text) ?? null;
const clickButton = (name: string) => {
  const btn = [...container.querySelectorAll("button")].find((b) => b.textContent === name);
  if (!btn) throw new Error(`no button ${name}`);
  act(() => btn.click());
};
const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

const stopTrack = vi.fn();
let getUserMedia: ReturnType<typeof vi.fn>;

describe("BarcodeScanner", () => {
  beforeEach(() => {
    reads.length = 0;
    detect.mockClear();
    stopTrack.mockClear();
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    const track = { stop: stopTrack, getCapabilities: () => ({}), applyConstraints: vi.fn(async () => undefined) };
    getUserMedia = vi.fn(async () => ({ getTracks: () => [track], getVideoTracks: () => [track] }));
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
    const proto = HTMLVideoElement.prototype;
    Object.defineProperty(proto, "readyState", { get: () => 4, configurable: true });
    Object.defineProperty(proto, "videoWidth", { get: () => 1920, configurable: true });
    Object.defineProperty(proto, "videoHeight", { get: () => 1080, configurable: true });
    Object.defineProperty(proto, "srcObject", { set: () => undefined, get: () => null, configurable: true });
    proto.play = vi.fn(async () => undefined);
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
  });
  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container.remove();
    vi.useRealTimers();
  });

  it("asks for the back camera at 1920x1080 and reads only retail formats", async () => {
    expect(SCANNER_FORMATS).toEqual(["ean_13", "ean_8", "upc_a", "upc_e"]);
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    await advance(0);
    expect(getUserMedia).toHaveBeenCalledWith(SCANNER_CONSTRAINTS);
    const video = SCANNER_CONSTRAINTS.video as MediaTrackConstraints;
    expect(video.facingMode).toEqual({ ideal: "environment" });
    expect(video.width).toEqual({ ideal: 1920 });
    expect(video.height).toEqual({ ideal: 1080 });
    const el = container.querySelector("video")!;
    expect(el.hasAttribute("playsinline")).toBe(true);
    expect(el.muted).toBe(true);
  });

  it("accepts a barcode only after the same valid value is read twice in a row", async () => {
    const onDetected = vi.fn();
    reads.push("5000112637922", null, "5000112637922", "5000112637922");
    render(<BarcodeScanner onDetected={onDetected} onClose={vi.fn()} />);
    await advance(SCANNER_DECODE_INTERVAL_MS * 2);
    expect(onDetected).not.toHaveBeenCalled();
    await advance(SCANNER_DECODE_INTERVAL_MS * 3);
    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledWith("5000112637922");
  });

  it("never accepts a value with a wrong check digit", async () => {
    const onDetected = vi.fn();
    reads.push("5000112637923", "5000112637923", "5000112637923");
    render(<BarcodeScanner onDetected={onDetected} onClose={vi.fn()} />);
    await advance(SCANNER_DECODE_INTERVAL_MS * 5);
    expect(onDetected).not.toHaveBeenCalled();
  });

  it("scans about every 100ms", async () => {
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    await advance(0);
    const before = detect.mock.calls.length;
    await advance(SCANNER_DECODE_INTERVAL_MS * 5);
    expect(detect.mock.calls.length - before).toBeGreaterThanOrEqual(4);
  });

  it("shows the camera-denied screen when access is blocked", async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    await advance(0);
    expect(queryText("barcode_scanner_denied")).not.toBeNull();
  });

  it("stops the camera when closed", async () => {
    const { unmount } = render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    await advance(0);
    unmount();
    expect(stopTrack).toHaveBeenCalled();
  });

  it("shows the help banner only after 10 seconds without a barcode", async () => {
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    await advance(SCANNER_HELP_DELAY_MS - 1);
    expect(queryText("barcode_scanner_trouble")).toBeNull();
    await advance(1);
    expect(queryText("barcode_scanner_trouble")).not.toBeNull();
  });

  it("does not show the banner after a barcode is detected", async () => {
    reads.push("5000112637922", "5000112637922");
    render(<BarcodeScanner onDetected={vi.fn()} onClose={vi.fn()} />);
    await advance(SCANNER_HELP_DELAY_MS);
    expect(queryText("barcode_scanner_trouble")).toBeNull();
  });

  it("'Type the number instead' calls onManualEntry, or onClose when it isn't given", async () => {
    const onClose = vi.fn();
    const onManualEntry = vi.fn();
    const { unmount } = render(<BarcodeScanner onDetected={vi.fn()} onClose={onClose} onManualEntry={onManualEntry} />);
    await advance(SCANNER_HELP_DELAY_MS);
    clickButton("barcode_scanner_type_instead");
    expect(onManualEntry).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    unmount();

    render(<BarcodeScanner onDetected={vi.fn()} onClose={onClose} />);
    expect(queryText("barcode_scanner_trouble")).toBeNull();
    await advance(SCANNER_HELP_DELAY_MS);
    clickButton("barcode_scanner_type_instead");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
