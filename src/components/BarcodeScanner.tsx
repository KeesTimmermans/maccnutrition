import { useEffect, useRef, useState } from "react";
import { X, Flashlight, FlashlightOff, ScanBarcode } from "lucide-react";
import { Button } from "./ui/button";
import { useLanguage } from "@/lib/i18n";
import {
  SCANNER_FORMATS,
  SCANNER_MIN_CROP_WIDTH,
  createStableReader,
  getBarcodeDetector,
  scanBoxCrop,
} from "@/lib/barcodeDetection";

export { SCANNER_FORMATS };

/** Back camera at a resolution high enough for small barcodes. */
export const SCANNER_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  },
};

export const SCANNER_DECODE_INTERVAL_MS = 100;
/** Show the "having trouble?" help after this long without a detection. */
export const SCANNER_HELP_DELAY_MS = 10_000;
/** On-screen scan box in CSS pixels (matches w-72 h-48 below). */
const SCAN_BOX = { width: 288, height: 192 };

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
  /** "Type the number instead" in the help banner; falls back to onClose. */
  onManualEntry?: () => void;
  /** Called once when the help banner appears. */
  onHelpShown?: () => void;
}

type TorchTrack = MediaStreamTrack;
type ExtraCaps = { torch?: boolean; focusMode?: string[] };
const capsOf = (track: TorchTrack | null) => (track?.getCapabilities?.() ?? {}) as ExtraCaps;

/** Best effort: continuous autofocus where the browser exposes it (iOS doesn't). */
async function enableContinuousFocus(track: TorchTrack | null) {
  try {
    const caps = capsOf(track);
    if (track && caps?.focusMode?.includes("continuous")) {
      await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
    }
  } catch {
    // Not supported here; scanning still works without it.
  }
}

export const BarcodeScanner = ({ onDetected, onClose, onManualEntry, onHelpShown }: BarcodeScannerProps) => {
  const { t } = useLanguage();
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const onHelpShownRef = useRef(onHelpShown);
  onHelpShownRef.current = onHelpShown;
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const detectedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<TorchTrack | null>(null);

  // Camera + scan loop, started once per opening.
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const stable = createStableReader();

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no camera"), { name: "NotFoundError" });
        stream = await navigator.mediaDevices.getUserMedia(SCANNER_CONSTRAINTS);
        if (cancelled) return stream.getTracks().forEach((tr) => tr.stop());
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        const track = (stream.getVideoTracks()[0] ?? null) as TorchTrack | null;
        trackRef.current = track;
        setTorchAvailable(!!capsOf(track).torch);
        void enableContinuousFocus(track);
      } catch (error) {
        const name = (error as { name?: string })?.name;
        console.error("Scanner error:", error);
        if (name === "NotAllowedError" || name === "SecurityError") setErrorKey("barcode_scanner_denied");
        else if (name === "NotFoundError" || name === "OverconstrainedError") setErrorKey("barcode_scanner_no_camera");
        return;
      }

      let detector;
      try {
        detector = await getBarcodeDetector();
      } catch (error) {
        console.error("Barcode reader failed to load:", error);
        return;
      }

      const tick = async () => {
        if (cancelled || detectedRef.current) return;
        const video = videoRef.current;
        if (video && ctx && video.readyState >= 2 && video.videoWidth > 0) {
          const crop = scanBoxCrop(
            { width: video.videoWidth, height: video.videoHeight },
            { width: video.clientWidth || video.videoWidth, height: video.clientHeight || video.videoHeight },
            SCAN_BOX,
          );
          const up = crop.sw < SCANNER_MIN_CROP_WIDTH ? SCANNER_MIN_CROP_WIDTH / crop.sw : 1;
          canvas.width = Math.round(crop.sw * up);
          canvas.height = Math.round(crop.sh * up);
          ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
          let value: string | null = null;
          try {
            const results = await detector.detect(canvas);
            value = results[0]?.rawValue ?? null;
          } catch {
            value = null;
          }
          const accepted = stable.push(value);
          if (accepted && !cancelled && !detectedRef.current) {
            detectedRef.current = true;
            setShowHelp(false);
            onDetectedRef.current(accepted);
            return;
          }
        }
        timer = setTimeout(tick, SCANNER_DECODE_INTERVAL_MS);
      };
      void tick();
    };
    void start();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
      trackRef.current = null;
    };
  }, []);

  // Help banner once per opening, after a while with nothing detected.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!detectedRef.current) {
        setShowHelp(true);
        onHelpShownRef.current?.();
      }
    }, SCANNER_HELP_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const toggleTorch = () => {
    const track = trackRef.current;
    if (!torchAvailable || !track) return;
    const next = !torchOn;
    track
      .applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => undefined);
  };

  if (errorKey) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <ScanBarcode className="w-10 h-10 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{t("barcode_scanner_error_title")}</h3>
        <p className="text-muted-foreground text-center mb-6">{t(errorKey)}</p>
        <Button variant="outline" onClick={onClose}>
          {t("barcode_scanner_go_back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
        <span className="text-white font-medium">{t("barcode_scanner_title")}</span>
        {torchAvailable && (
          <button
            onClick={toggleTorch}
            className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
          >
            {torchOn ? (
              <FlashlightOff className="w-6 h-6 text-white" />
            ) : (
              <Flashlight className="w-6 h-6 text-white" />
            )}
          </button>
        )}
        {!torchAvailable && <div className="w-10" />}
      </div>

      {/* Scanner */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Scan overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Darkened corners */}
          <div className="absolute inset-0 bg-black/50" />
          
          {/* Clear scanning area */}
          <div className="relative w-72 h-48">
            {/* Cut out the center */}
            <div className="absolute inset-0 bg-transparent" 
                 style={{ 
                   boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)"
                 }} 
            />
            
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
            
            {/* Scanning line animation */}
            <div className="absolute left-4 right-4 h-0.5 bg-primary animate-pulse" />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/80 to-transparent space-y-4">
        {showHelp && (
          <div role="status" className="rounded-2xl bg-white/15 backdrop-blur-sm p-4 space-y-3">
            <p className="text-white text-sm text-center">{t("barcode_scanner_trouble")}</p>
            <Button variant="secondary" className="w-full" onClick={onManualEntry ?? onClose}>
              {t("barcode_scanner_type_instead")}
            </Button>
          </div>
        )}
        <p className="text-white/80 text-center text-sm">
          {t("barcode_scanner_hint")}
        </p>
      </div>
    </div>
  );
};
