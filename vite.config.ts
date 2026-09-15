import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

export default defineConfig({
  plugins: [
    react(),
    // Compress every raster asset at build time (bundled @assets AND /public
    // images) with sharp. These source PNGs are 1–4.7MB illustrations/mandalas;
    // palette quantization + max compression typically cuts them 50–75% with no
    // visible change. Filenames/extensions are preserved, so no code changes.
    ViteImageOptimizer({
      png: { quality: 80, palette: true, compressionLevel: 9, effort: 10 },
      jpeg: { quality: 78, mozjpeg: true },
      jpg: { quality: 78, mozjpeg: true },
      webp: { quality: 80, effort: 6 },
      svg: {
        multipass: true,
        plugins: [
          { name: "preset-default", params: { overrides: { removeViewBox: false } } },
        ],
      },
    }),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Raise the warning threshold — the vendor/i18n chunks are intentionally
    // large and content-hashed, so they cache across deploys.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Split rarely-changing vendor code and the big translation data into
        // their own long-cached chunks. This keeps the app chunk small (so a
        // code change doesn't re-download React/Radix/i18n) and lets the
        // browser fetch these in parallel with the entry chunk.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom") || /[\\/]react[\\/]/.test(id) || id.includes("scheduler")) {
              return "react-vendor";
            }
            if (id.includes("@radix-ui")) return "radix-vendor";
            if (id.includes("@tanstack")) return "query-vendor";
            if (id.includes("lucide-react")) return "icons-vendor";
            return "vendor";
          }
          // The two ~8k-line translation tables are pure data; isolate them so
          // editing app code never busts their cache.
          if (id.includes("/lib/translations") || id.includes("/lib/content-translations")) {
            return "i18n-data";
          }
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
