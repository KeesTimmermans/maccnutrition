import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ScanBarcode, Package, WifiOff, SearchX, CameraOff, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { scoreProduct, type ProductScoreResult } from "@/lib/foodScore";
import {
  isValidBarcode,
  lookupProductForScore,
  productBrand,
  productDisplayName,
  toScoreInput,
  type ProductLookup,
} from "@/lib/productScoreService";
import { trackProductScored } from "@/lib/analytics";
import type { Alternative } from "@/lib/productAlternatives";
import { StorePicker, usePreferredStore } from "@/components/scanRate/StorePicker";
import { BetterOptions } from "@/components/scanRate/BetterOptions";
import { BAND_STYLES } from "@/components/scanRate/bandStyles";

interface ScanOutcome {
  product: ProductLookup;
  result: ProductScoreResult | null;
}

/** Products scoring below this get a "Better options" section. */
const BETTER_OPTIONS_BELOW = 7;

type CameraProblem = "denied" | "none" | "unavailable";

/**
 * Asks for the camera once before opening the scanner, so a missing camera or a
 * denied permission becomes a friendly message instead of a black screen.
 */
async function checkCamera(): Promise<CameraProblem | null> {
  if (!navigator.mediaDevices?.getUserMedia) return "unavailable";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    stream.getTracks().forEach((track) => track.stop());
    return null;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAllowedError" || name === "SecurityError") return "denied";
    if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "none";
    return "unavailable";
  }
}

const CAMERA_MESSAGE_KEYS: Record<CameraProblem, string> = {
  denied: "scan_rate_camera_denied",
  none: "scan_rate_camera_none",
  unavailable: "scan_rate_camera_unavailable",
};

/** True when the failure is the connection or the product database, not our app. */
function isNetworkError(error: unknown): boolean {
  const e = error as { name?: string; context?: { status?: number } } | null;
  if (!e) return false;
  if (e.name === "FunctionsFetchError" || e.name === "TypeError") return true;
  const status = e.context?.status;
  return status === 502 || status === 503 || status === 504;
}

const ScanRate = () => {
  const { t } = useLanguage();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [cameraProblem, setCameraProblem] = useState<CameraProblem | null>(null);
  const [checkingCamera, setCheckingCamera] = useState(false);
  const [viewingAlt, setViewingAlt] = useState<Alternative | null>(null);
  const { store, loading: storeLoading, setStore } = usePreferredStore();

  const lookup = useMutation<ScanOutcome, unknown, string>({
    mutationFn: async (barcode) => {
      const product = await lookupProductForScore(barcode);
      const result = product.found ? scoreProduct(toScoreInput(product)) : null;
      trackProductScored({
        found: product.found,
        confidence: result?.confidence ?? null,
        score: result?.score ?? null,
        barcodePrefix: barcode,
      });
      return { product, result };
    },
  });

  const runLookup = (raw: string) => {
    const barcode = raw.replace(/\s+/g, "");
    setLastBarcode(barcode);
    setViewingAlt(null);
    lookup.mutate(barcode);
  };

  const handleDetected = (barcode: string) => {
    setScanning(false);
    runLookup(barcode);
  };

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = manual.replace(/\s+/g, "");
    if (!isValidBarcode(value)) {
      setManualError(t("scan_rate_manual_invalid"));
      return;
    }
    setManualError(null);
    runLookup(value);
  };

  const reset = () => {
    lookup.reset();
    setViewingAlt(null);
    setManual("");
    setManualError(null);
    setLastBarcode(null);
  };

  const openScanner = async () => {
    setCheckingCamera(true);
    const problem = await checkCamera();
    setCheckingCamera(false);
    setCameraProblem(problem);
    if (!problem) setScanning(true);
  };

  const scanAnother = () => {
    reset();
    void openScanner();
  };

  if (scanning) {
    return <BarcodeScanner onDetected={handleDetected} onClose={() => setScanning(false)} />;
  }

  const outcome = lookup.data;

  return (
    <AppLayout>
      <div className="p-4 space-y-5">
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground pt-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("scan_rate_back")}
        </Link>

        <header>
          <h1 className="text-2xl font-bold text-foreground">{t("tool_scan_rate_name")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("scan_rate_intro")}</p>
        </header>

        <StorePicker store={store} loading={storeLoading} onChange={setStore} />

        {lookup.isPending && <ResultSkeleton />}

        {lookup.isError && (
          <StateCard
            icon={WifiOff}
            message={isNetworkError(lookup.error) ? t("scan_rate_error_network") : t("scan_rate_error_generic")}
          >
            <Button className="w-full" onClick={() => lastBarcode && runLookup(lastBarcode)}>
              {t("scan_rate_try_again")}
            </Button>
            <Button variant="outline" className="w-full" onClick={scanAnother}>
              {t("scan_rate_scan_another")}
            </Button>
          </StateCard>
        )}

        {outcome && !outcome.product.found && (
          <StateCard icon={SearchX} message={t("scan_rate_not_found")}>
            <Button className="w-full" onClick={scanAnother}>
              <ScanBarcode className="w-4 h-4 mr-2" />
              {t("scan_rate_scan_another")}
            </Button>
          </StateCard>
        )}

        {outcome && outcome.product.found && viewingAlt && (
          <>
            <button
              type="button"
              onClick={() => setViewingAlt(null)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("scan_rate_back_to").replace(
                "{name}",
                productDisplayName(outcome.product) ?? t("scan_rate_unnamed"),
              )}
            </button>
            <ResultCard
              product={viewingAlt.product}
              result={scoreProduct(toScoreInput(viewingAlt.product))}
              onScanAnother={scanAnother}
            />
          </>
        )}

        {outcome && outcome.product.found && !viewingAlt && (
          <>
            <ResultCard product={outcome.product} result={outcome.result} onScanAnother={scanAnother} />
            {outcome.result?.score != null &&
              outcome.result.score < BETTER_OPTIONS_BELOW &&
              outcome.result.confidence === "full" && (
                <BetterOptions
                  barcode={outcome.product.code ?? lastBarcode ?? ""}
                  score={outcome.result.score}
                  categoriesTags={outcome.product.categories_tags}
                  store={store}
                  onSelect={(alt) => {
                    setViewingAlt(alt);
                    window.scrollTo({ top: 0 });
                  }}
                />
              )}
          </>
        )}

        {lookup.isIdle && (
          <Card className="bg-card rounded-3xl shadow-medium p-5 space-y-5">
            <Button
              size="lg"
              className="w-full h-14 text-base rounded-2xl"
              onClick={() => void openScanner()}
              disabled={checkingCamera}
            >
              {checkingCamera ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <ScanBarcode className="w-5 h-5 mr-2" />
              )}
              {t("scan_rate_scan_button")}
            </Button>

            {cameraProblem && (
              <div role="alert" className="flex gap-3 rounded-2xl bg-muted p-3 text-sm text-foreground">
                <CameraOff className="w-5 h-5 shrink-0 text-muted-foreground" />
                <p>{t(CAMERA_MESSAGE_KEYS[cameraProblem])}</p>
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="space-y-2">
              <Label htmlFor="manual-barcode" className="text-sm text-muted-foreground">
                {t("scan_rate_manual_label")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="manual-barcode"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={t("scan_rate_manual_placeholder")}
                  value={manual}
                  onChange={(e) => {
                    setManual(e.target.value);
                    if (manualError) setManualError(null);
                  }}
                  aria-invalid={!!manualError}
                />
                <Button type="submit" variant="outline">
                  {t("scan_rate_manual_submit")}
                </Button>
              </div>
              {manualError && <p className="text-sm text-destructive">{manualError}</p>}
            </form>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

function ResultSkeleton() {
  return (
    <Card className="bg-card rounded-3xl shadow-medium p-5 space-y-4" aria-busy="true">
      <div className="flex items-center gap-4">
        <Skeleton className="w-20 h-20 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-7 w-32 rounded-full" />
      </div>
    </Card>
  );
}

function StateCard({
  icon: Icon,
  message,
  children,
}: {
  icon: typeof WifiOff;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-card rounded-3xl shadow-medium p-6 flex flex-col items-center text-center gap-4">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="text-foreground font-medium">{message}</p>
      <div className="w-full space-y-2">{children}</div>
    </Card>
  );
}

function ResultCard({
  product,
  result,
  onScanAnother,
}: {
  product: ProductLookup;
  result: ProductScoreResult | null;
  onScanAnother: () => void;
}) {
  const { t } = useLanguage();
  const [imageFailed, setImageFailed] = useState(false);
  const name = productDisplayName(product) ?? t("scan_rate_unnamed");
  const brand = productBrand(product);
  const band = result?.band ? BAND_STYLES[result.band] : null;

  return (
    <Card className="bg-card rounded-3xl shadow-medium p-5 space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {product.image_url && !imageFailed ? (
            <img
              src={product.image_url}
              alt={name}
              className="w-full h-full object-contain"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <Package className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-foreground leading-snug">{name}</p>
          {brand && <p className="text-sm text-muted-foreground truncate">{brand}</p>}
        </div>
      </div>

      {result && result.score !== null && band ? (
        <>
          <div className={cn("rounded-2xl p-5 text-center", band.bg)}>
            <p className={cn("text-5xl font-bold tabular-nums", band.text)}>
              {result.score}
              <span className="text-2xl font-semibold opacity-70">/10</span>
            </p>
            <p className={cn("mt-1 font-semibold", band.text)}>{t(band.key)}</p>
          </div>

          {result.reasons.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.reasons.map((reason) => (
                <span
                  key={reason}
                  className="px-3 py-1.5 rounded-full bg-muted text-sm font-medium text-foreground"
                >
                  {t(reason)}
                </span>
              ))}
            </div>
          )}

          {result.confidence === "limited" && (
            <p className="text-xs text-muted-foreground">{t("scan_rate_limited")}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("scan_rate_no_score")}</p>
      )}

      <Button className="w-full" onClick={onScanAnother}>
        <ScanBarcode className="w-4 h-4 mr-2" />
        {t("scan_rate_scan_another")}
      </Button>
    </Card>
  );
}

export default ScanRate;
