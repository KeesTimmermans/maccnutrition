import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initPostHog } from "@/analytics/posthog";
import { supabase } from "@/integrations/supabase/client";

// HashRouter requires a hash in the URL. When returning from external redirects (like Stripe
// or auth password reset), the hash is often lost. Detect this and redirect to ensure
// the router works.
(function ensureHashRoute() {
  const { pathname, search, hash } = window.location;

  // If we have a checkout param in the query string, store it and redirect to hash route
  const params = new URLSearchParams(search);
  const checkout = params.get("checkout");

  if (checkout) {
    sessionStorage.setItem("checkout_return", checkout);
    window.history.replaceState(null, "", `${pathname}#/`);
    return;
  }

  // Handle /reset-password redirect from auth email links (supports query or hash token payloads)
  if (pathname.endsWith("/reset-password")) {
    // Standard case: token_hash is in query params
    if (params.has("token_hash") && params.get("type") === "recovery") {
      window.location.replace(`${window.location.origin}/#/reset-password${search}`);
      return;
    }

    // Fallback: providers may deliver tokens inside URL hash fragment
    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const tokenHashFromHash = hashParams.get("token_hash");
    const typeFromHash = hashParams.get("type");
    const accessTokenFromHash = hashParams.get("access_token");
    const refreshTokenFromHash = hashParams.get("refresh_token");

    if (tokenHashFromHash && typeFromHash === "recovery") {
      const normalizedSearch = new URLSearchParams({
        token_hash: tokenHashFromHash,
        type: typeFromHash,
      }).toString();
      window.location.replace(`${window.location.origin}/#/reset-password?${normalizedSearch}`);
      return;
    }

    // Common recovery format: #access_token=...&refresh_token=...&type=recovery
    if (accessTokenFromHash && refreshTokenFromHash && typeFromHash === "recovery") {
      void supabase.auth
        .setSession({ access_token: accessTokenFromHash, refresh_token: refreshTokenFromHash })
        .finally(() => {
          window.location.replace(`${window.location.origin}/#/reset-password`);
        });
      return;
    }

    // No token payload found; still route to reset page so user can re-request email
    window.location.replace(`${window.location.origin}/#/reset-password`);
    return;
  }

  // Only add hash if completely missing
  if (!hash) {
    window.history.replaceState(null, "", `${pathname}${search}#/`);
  }
})();

// Register service worker for push notifications
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((err) => {
    console.warn("SW registration failed:", err);
  });
}

initPostHog();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
