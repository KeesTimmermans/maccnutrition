import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Capacitor } from "@capacitor/core";

declare const __APP_VERSION__: string;

export function UpdateAvailableBanner() {
  // Native must never run any of this.
  if (Capacitor.isNativePlatform()) return null;

  return <WebUpdateBanner />;
}

function WebUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const current =
      typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : undefined;
    if (current) {
      (window as unknown as Record<string, unknown>).__APP_VERSION__ = current;
    }

    (async () => {
      try {
        const res = await fetch(`/version.json?_=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const deployed = data?.version ? String(data.version) : null;
        const cached = (window as unknown as Record<string, unknown>).__APP_VERSION__;
        if (!cancelled && deployed && cached && deployed !== String(cached)) {
          setUpdateAvailable(true);
        }
      } catch {
        // silently ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!updateAvailable || dismissed) return null;

  const handleUpdate = () => {
    window.location.href =
      window.location.pathname +
      window.location.search +
      (window.location.search ? "&" : "?") +
      "_fresh=" +
      Date.now() +
      window.location.hash;
  };

  return (
    <div
      role="status"
      aria-label="Update available"
      className="fixed bottom-0 left-0 right-0 z-[70] border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">A new version of the app is available.</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleUpdate}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Update
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="rounded-md border border-border bg-background p-1.5 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
