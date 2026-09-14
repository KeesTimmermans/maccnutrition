import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  const buildTimestamp = Date.now().toString();

  const versionJsonPlugin = {
    name: "write-version-json",
    writeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      fs.writeFileSync(
        path.resolve(outDir, "version.json"),
        JSON.stringify({ version: buildTimestamp })
      );
    },
  };

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
    plugins: [react(), mcpPlugin(), mode === "development" && componentTagger(), versionJsonPlugin].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Inject PostHog publishable keys from build environment.
    // Set VITE_POSTHOG_API_KEY and VITE_POSTHOG_HOST in your .env or CI secrets.
    define: {
      __APP_VERSION__: JSON.stringify(buildTimestamp),
      "import.meta.env.VITE_POSTHOG_API_KEY": JSON.stringify(process.env.VITE_POSTHOG_API_KEY ?? process.env.POSTHOG_API_KEY ?? ""),
      "import.meta.env.VITE_POSTHOG_HOST": JSON.stringify(process.env.VITE_POSTHOG_HOST ?? process.env.POSTHOG_HOST ?? "https://app.posthog.com"),
    },
  };
});

