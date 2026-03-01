import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initPostHog } from "@/analytics/posthog";

// HashRouter requires a hash in the URL. When returning from external redirects (like Stripe
// or Supabase password reset), the hash is often lost. Detect this and redirect to ensure
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

  // Handle /reset-password redirect from Supabase (non-hash URL with token_hash)
  if (pathname.endsWith("/reset-password")) {
    // Preserve query params so the reset page can read token_hash & type
    window.location.replace(`${window.location.origin}/#/reset-password${search}`);
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
