import { useEffect, useRef, useState } from "react";
import { useZxing } from "react-zxing";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { X, Flashlight, FlashlightOff, ScanBarcode } from "lucide-react";
import { Button } from "./ui/button";
import { useLanguage } from "@/lib/i18n";

/** Created once: rebuilding the hints on every render rebuilds the reader and restarts the camera. */
export const SCANNER_HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
  [DecodeHintType.TRY_HARDER, true],
]);

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

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
  /** "Type the number instead" in the help banner; falls back to onClose. */
  onManualEntry?: () => void;
}

/** Best effort: continuous autofocus where the browser exposes it (iOS doesn't). */
async function enableContinuousFocus(video: HTMLVideoElement | null) {
  try {
    const stream = video?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks?.()[0];
    const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { focusMode?: string[] }) | undefined;
    if (track && caps?.focusMode?.includes("continuous")) {
      await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
    }
  } catch {
    // Not supported here; scanning still works without it.
  }
}

export const BarcodeScanner = ({ onDetected, onClose, onManualEntry }: BarcodeScannerProps) => {
  const { t } = useLanguage();
  const [torchOn, setTorchOn] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const detectedRef = useRef(false);

  const { ref, torch } = useZxing({
    hints: SCANNER_HINTS,
    constraints: SCANNER_CONSTRAINTS,
    timeBetweenDecodingAttempts: SCANNER_DECODE_INTERVAL_MS,
    onResult(result) {
      if (!detectedRef.current) {
        detectedRef.current = true;
        setShowHelp(false);
        onDetected(result.getText());
      }
    },
    onError(error) {
      console.error("Scanner error:", error);
      if (error.name === "NotAllowedError") {
        setErrorKey("barcode_scanner_denied");
      } else if (error.name === "NotFoundError") {
        setErrorKey("barcode_scanner_no_camera");
      }
    },
  });

  // Once the picture is playing, try to switch on continuous focus.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const onPlaying = () => void enableContinuousFocus(video);
    video.addEventListener("playing", onPlaying);
    return () => video.removeEventListener("playing", onPlaying);
  }, [ref]);

  // Help banner once per opening, after a while with nothing detected.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!detectedRef.current) setShowHelp(true);
    }, SCANNER_HELP_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const toggleTorch = () => {
    if (torch.isAvailable) {
      if (torchOn) {
        torch.off();
      } else {
        torch.on();
      }
      setTorchOn(!torchOn);
    }
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
        {torch.isAvailable && (
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
        {!torch.isAvailable && <div className="w-10" />}
      </div>

      {/* Scanner */}
      <div className="flex-1 relative">
        <video
          ref={ref}
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
