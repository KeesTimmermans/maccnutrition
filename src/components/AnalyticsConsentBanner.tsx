import { useState } from "react";
import { getConsent, setConsent } from "@/analytics/posthog";

export function AnalyticsConsentBanner() {
  const [visible, setVisible] = useState(() => getConsent() === "unset");

  if (!visible) return null;

  const handle = (accepted: boolean) => {
    setConsent(accepted);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      className="fixed bottom-0 left-0 right-0 z-[70] border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Optional analytics. We don't track food items, macros, calories, or health metrics.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => handle(false)}
            className="rounded-md border border-border bg-background px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => handle(true)}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
