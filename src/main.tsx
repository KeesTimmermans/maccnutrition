import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// HashRouter requires a hash in the URL. When returning from external redirects (like Stripe),
// the hash is often lost. Detect this and redirect to ensure the router works.
(function ensureHashRoute() {
  const { pathname, search, hash } = window.location;
  
  // If we have a checkout param but no hash, we're returning from Stripe
  const params = new URLSearchParams(search);
  const checkout = params.get("checkout");
  
  if (checkout) {
    // Store the checkout status in sessionStorage so we can pick it up after redirect
    sessionStorage.setItem("checkout_return", checkout);
    // Redirect to the hash route without query params
    window.location.replace(`${window.location.origin}${pathname}#/`);
    return; // Stop execution - page will reload
  }
  
  // If there's no hash at all, add the default hash route
  if (!hash || hash === "") {
    window.location.replace(`${window.location.origin}${pathname}${search}#/`);
    return;
  }
})();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
