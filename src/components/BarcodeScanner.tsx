import { useEffect, useRef, useState } from "react";
import { useZxing } from "react-zxing";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { X, Flashlight, FlashlightOff, ScanBarcode } from "lucide-react";
import { Button } from "./ui/button";

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export const BarcodeScanner = ({ onDetected, onClose }: BarcodeScannerProps) => {
  const [torchOn, setTorchOn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const detectedRef = useRef(false);

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);

  const { ref, torch } = useZxing({
    hints,
    onResult(result) {
      if (!detectedRef.current) {
        detectedRef.current = true;
        const barcode = result.getText();
        console.log("Barcode detected:", barcode);
        onDetected(barcode);
      }
    },
    onError(error) {
      console.error("Scanner error:", error);
      if (error.name === "NotAllowedError") {
        setErrorMessage("Camera access denied. Please allow camera access in your browser settings.");
      } else if (error.name === "NotFoundError") {
        setErrorMessage("No camera found on this device.");
      }
    },
  });

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

  if (errorMessage) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <ScanBarcode className="w-10 h-10 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Scanner Error</h3>
        <p className="text-muted-foreground text-center mb-6">{errorMessage}</p>
        <Button variant="outline" onClick={onClose}>
          Go Back
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
        <span className="text-white font-medium">Scan Barcode</span>
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
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-white/80 text-center text-sm">
          Position the barcode within the frame
        </p>
      </div>
    </div>
  );
};
