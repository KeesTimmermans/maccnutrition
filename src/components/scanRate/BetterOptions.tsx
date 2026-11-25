import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { trackAlternativesShown } from "@/lib/analytics";
import { pickAlternatives, type Alternative, type AlternativeCandidate } from "@/lib/productAlternatives";
import { productBrand, productDisplayName } from "@/lib/productScoreService";
import type { StoreKey } from "../../../supabase/functions/_shared/offCategories.ts";
import { BAND_STYLES } from "./bandStyles";

interface AlternativesResponse {
  candidates: AlternativeCandidate[];
  matchedCategory: string | null;
  error?: boolean;
  source?: "live" | "cache" | "stale";
}

interface Props {
  barcode: string;
  score: number;
  categoriesTags: string[] | null | undefined;
  store: StoreKey | null;
  onSelect: (alternative: Alternative) => void;
}

export function BetterOptions({ barcode, score, categoriesTags, store, onSelect }: Props) {
  const { t } = useLanguage();
  const tags = categoriesTags ?? [];

  const query = useQuery({
    queryKey: ["product-alternatives", barcode, store ?? "none"],
    queryFn: async (): Promise<AlternativesResponse> => {
      const { data, error } = await supabase.functions.invoke<AlternativesResponse>("product-alternatives", {
        body: { barcode, categoriesTags: tags.slice(0, 30), store: store ?? undefined },
      });
      if (error || !data || data.error) throw error ?? new Error("Alternatives unavailable");
      return data;
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const pick = useMemo(
    () => (query.data ? pickAlternatives({ barcode, score, categoriesTags: tags }, query.data.candidates, store) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.data, barcode, score, store],
  );

  // One analytics event per product + store result.
  const logged = useRef(new Set<string>());
  useEffect(() => {
    if (!pick || !query.data) return;
    const key = `${barcode}|${store ?? ""}`;
    if (logged.current.has(key)) return;
    logged.current.add(key);
    trackAlternativesShown({
      count: pick.alternatives.length,
      inStoreCount: pick.alternatives.filter((a) => a.inStore).length,
      hadStore: !!store,
      store,
      sourceCategory: query.data.matchedCategory,
      candidateCount: query.data.candidates?.length ?? 0,
      tier: pick.tier ?? null,
      scoredCount: pick.scoredCount ?? 0,
      scannedScore: score,
      source: query.data.source ?? null,
    });
  }, [pick, query.data, barcode, store]);

  const storeName = store ? t(`store_${store}`) : "";
  // A retry after an error shows the skeleton again instead of the old error text.
  const loading = query.isPending || (query.isError && query.isFetching);

  return (
    <section className="space-y-3" aria-labelledby="better-options-title">
      <h2 id="better-options-title" className="text-lg font-bold text-foreground">
        {t("better_options_title")}
      </h2>

      {loading && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="rounded-2xl p-3 flex items-center gap-3">
              <Skeleton className="w-14 h-14 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-12 rounded-full" />
            </Card>
          ))}
        </div>
      )}

      {query.isError && !query.isFetching && (
        <p className="text-sm text-muted-foreground">
          {t("better_options_error")}.{" "}
          <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => void query.refetch()}>
            {t("better_options_retry")}
          </button>
        </p>
      )}

      {pick && pick.alternatives.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("better_options_none")}</p>
      )}

      {pick && pick.alternatives.length > 0 && (
        <>
          <div className="space-y-2">
            {pick.alternatives.map((alt) => (
              <AlternativeCard key={alt.product.code ?? ""} alt={alt} storeName={storeName} onSelect={() => onSelect(alt)} />
            ))}
          </div>
          {pick.relaxed && <p className="text-sm text-muted-foreground">{t("better_options_best_available")}</p>}
          {store && !pick.anyInStore && (
            <p className="text-sm text-muted-foreground">{t("better_options_unconfirmed").replace("{store}", storeName)}</p>
          )}
          {!store && <p className="text-sm text-muted-foreground">{t("better_options_pick_store")}</p>}
        </>
      )}
    </section>
  );
}

function AlternativeCard({ alt, storeName, onSelect }: { alt: Alternative; storeName: string; onSelect: () => void }) {
  const { t } = useLanguage();
  const [imageFailed, setImageFailed] = useState(false);
  const name = productDisplayName(alt.product) ?? t("scan_rate_unnamed");
  const brand = productBrand(alt.product);
  const band = BAND_STYLES[alt.band];

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="rounded-2xl p-3 flex items-center gap-3 transition-transform active:scale-[0.99]">
        <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {alt.product.image_url && !imageFailed ? (
            <img
              src={alt.product.image_url}
              alt=""
              loading="lazy"
              className="w-full h-full object-contain"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <Package className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-semibold text-sm text-foreground leading-snug line-clamp-2">{name}</p>
          {brand && <p className="text-xs text-muted-foreground truncate">{brand}</p>}
          <div className="flex flex-wrap gap-1.5">
            {alt.reasonKey && (
              <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium text-foreground">{t(alt.reasonKey)}</span>
            )}
            {alt.inStore && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-xs font-medium text-primary">
                <Store className="w-3 h-3" />
                {t("better_options_at_store").replace("{store}", storeName)}
              </span>
            )}
          </div>
        </div>
        <span className={cn("shrink-0 px-2.5 py-1 rounded-full text-sm font-bold tabular-nums", band.bg, band.text)}>
          {alt.score}/10
        </span>
      </Card>
    </button>
  );
}
