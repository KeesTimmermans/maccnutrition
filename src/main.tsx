import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// HashRouter requires a hash in the URL. When returning from external redirects (like Stripe),
// the hash is often lost. Detect this and redirect to ensure the router works.
// NOTE: We only redirect if absolutely necessary to avoid infinite loops.
(function ensureHashRoute() {
  const { pathname, search, hash } = window.location;

  // If we have a checkout param in the query string, store it and redirect to hash route
  const params = new URLSearchParams(search);
  const checkout = params.get("checkout");

  if (checkout) {
    sessionStorage.setItem("checkout_return", checkout);
    // Remove query params and add hash
    window.location.replace(`${window.location.origin}${pathname}#/`);
    return;
  }

  // Only add hash if completely missing - don't redirect if we already have one
  // This prevents redirect loops
  if (!hash) {
    // Use replaceState instead of location.replace to avoid a full reload
    window.history.replaceState(null, "", `${pathname}${search}#/`);
  }
})();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
