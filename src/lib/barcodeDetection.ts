/**
 * Barcode reading for the scanner: the browser's own BarcodeDetector when it exists,
 * otherwise the `barcode-detector` ponyfill (ZXing in WebAssembly). The .wasm file is
 * bundled with the app (served from our own origin), never downloaded from a CDN.
 */
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

export const SCANNER_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;
/** The same value must be read this many times in a row before it is accepted. */
export const SCANNER_CONFIRMATIONS = 2;

export interface Detector {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string; format?: string }>>;
}

type DetectorCtor = {
  new (opts: { formats: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

let detectorPromise: Promise<Detector> | null = null;

async function createDetector(): Promise<Detector> {
  const Native = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (Native) {
    try {
      const supported = (await Native.getSupportedFormats?.()) ?? [];
      if (SCANNER_FORMATS.every((f) => supported.includes(f))) {
        return new Native({ formats: [...SCANNER_FORMATS] });
      }
    } catch {
      // Fall through to the ponyfill.
    }
  }
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
    },
    fireImmediately: true,
  });
  return new BarcodeDetector({ formats: [...SCANNER_FORMATS] }) as unknown as Detector;
}

/** One detector per app session (the WebAssembly module loads once). */
export function getBarcodeDetector(): Promise<Detector> {
  if (!detectorPromise) {
    detectorPromise = createDetector().catch((err) => {
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
}

/** True when an EAN-13, EAN-8, UPC-A or UPC-E (8 digits) code has a valid check digit. */
export function isValidRetailBarcode(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  let digits = code;
  if (code.length === 8 && /^[01]/.test(code) && !eanCheckOk(code)) {
    // UPC-E: expand to UPC-A and check that.
    const upcA = expandUpcE(code);
    return !!upcA && eanCheckOk(upcA);
  }
  if (![8, 12, 13].includes(digits.length)) return false;
  return eanCheckOk(digits);
}

/** GS1 mod-10 check: weights 3,1 from the right (excluding the check digit). */
function eanCheckOk(code: string): boolean {
  const body = code.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10 === Number(code[code.length - 1]);
}

function expandUpcE(code: string): string | null {
  const ns = code[0];
  const d = code.slice(1, 7);
  const check = code[7];
  const last = d[5];
  let body: string;
  if ("012".includes(last)) body = d.slice(0, 2) + last + "0000" + d.slice(2, 5);
  else if (last === "3") body = d.slice(0, 3) + "00000" + d.slice(3, 5);
  else if (last === "4") body = d.slice(0, 4) + "00000" + d[4];
  else body = d.slice(0, 5) + "0000" + last;
  return ns + body + check;
}

/** Accepts a value only after it is read SCANNER_CONFIRMATIONS times in a row. */
export function createStableReader(confirmations = SCANNER_CONFIRMATIONS) {
  let last: string | null = null;
  let count = 0;
  return {
    /** Feed one frame's read (null = nothing read). Returns the value once confirmed. */
    push(value: string | null): string | null {
      if (!value || !isValidRetailBarcode(value)) {
        last = null;
        count = 0;
        return null;
      }
      if (value === last) count += 1;
      else {
        last = value;
        count = 1;
      }
      return count >= confirmations ? value : null;
    },
    reset() {
      last = null;
      count = 0;
    },
  };
}

/**
 * Source rectangle (video pixels) for the on-screen scan box, given the video is shown
 * with object-cover in a container. Slightly larger than the box so edges aren't cut.
 */
export function scanBoxCrop(
  video: { width: number; height: number },
  container: { width: number; height: number },
  box: { width: number; height: number },
  margin = 1.25,
) {
  const scale = Math.max(container.width / video.width, container.height / video.height) || 1;
  const w = Math.min(video.width, (box.width * margin) / scale);
  const h = Math.min(video.height, (box.height * margin) / scale);
  return { sx: (video.width - w) / 2, sy: (video.height - h) / 2, sw: w, sh: h };
}

/** Minimum crop width handed to the detector; smaller crops are upscaled. */
export const SCANNER_MIN_CROP_WIDTH = 600;
