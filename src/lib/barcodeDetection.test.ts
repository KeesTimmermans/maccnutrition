import { describe, it, expect, vi } from "vitest";
vi.mock("zxing-wasm/reader/zxing_reader.wasm?url", () => ({ default: "/assets/zxing_reader.wasm" }));
import { isValidRetailBarcode, createStableReader, scanBoxCrop } from "./barcodeDetection";

describe("isValidRetailBarcode", () => {
  it("accepts valid EAN-13, EAN-8, UPC-A and UPC-E", () => {
    expect(isValidRetailBarcode("5000112637922")).toBe(true);
    expect(isValidRetailBarcode("96385074")).toBe(true);
    expect(isValidRetailBarcode("036000291452")).toBe(true);
    expect(isValidRetailBarcode("04252614")).toBe(true);
  });
  it("rejects wrong check digits, letters and odd lengths", () => {
    expect(isValidRetailBarcode("5000112637923")).toBe(false);
    expect(isValidRetailBarcode("036000291453")).toBe(false);
    expect(isValidRetailBarcode("50001126379A2")).toBe(false);
    expect(isValidRetailBarcode("12345")).toBe(false);
  });
});

describe("createStableReader", () => {
  it("needs the same value twice in a row", () => {
    const r = createStableReader();
    expect(r.push("5000112637922")).toBeNull();
    expect(r.push("5000112637922")).toBe("5000112637922");
  });
  it("a different value or an empty frame restarts the count", () => {
    const r = createStableReader();
    r.push("5000112637922");
    expect(r.push("96385074")).toBeNull();
    expect(r.push(null)).toBeNull();
    expect(r.push("96385074")).toBeNull();
    expect(r.push("96385074")).toBe("96385074");
  });
  it("ignores invalid reads", () => {
    const r = createStableReader();
    expect(r.push("5000112637923")).toBeNull();
    expect(r.push("5000112637923")).toBeNull();
  });
});

describe("scanBoxCrop", () => {
  it("maps the centred on-screen box into video pixels (object-cover)", () => {
    // 1920x1080 video in a 390x844 phone screen: scale = 844/1080.
    const c = scanBoxCrop({ width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 288, height: 192 }, 1);
    expect(Math.round(c.sw)).toBe(Math.round(288 / (844 / 1080)));
    expect(Math.round(c.sx)).toBe(Math.round((1920 - c.sw) / 2));
    expect(c.sh).toBeLessThanOrEqual(1080);
  });
});
