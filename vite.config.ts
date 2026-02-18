import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    server: {
      host: "::",
      port: 8080,
      strictPort: true,
      // In proxied/embedded previews, Vite's default HMR websocket can pick the wrong
      // protocol/port and get stuck in reconnect loops.
      hmr: isDev
        ? {
            protocol: "wss",
            clientPort: 443,
          }
        : undefined,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Inject PostHog publishable keys from build environment.
    // Set VITE_POSTHOG_API_KEY and VITE_POSTHOG_HOST in your .env or CI secrets.
    define: {
      "import.meta.env.VITE_POSTHOG_API_KEY": JSON.stringify(process.env.VITE_POSTHOG_API_KEY ?? process.env.POSTHOG_API_KEY ?? ""),
      "import.meta.env.VITE_POSTHOG_HOST": JSON.stringify(process.env.VITE_POSTHOG_HOST ?? process.env.POSTHOG_HOST ?? "https://app.posthog.com"),
    },
  };
});

