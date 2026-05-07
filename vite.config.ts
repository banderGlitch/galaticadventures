import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Split React only. Extra splits (three / motion / …) caused Rollup circular chunks and a production TDZ crash: "Cannot access … before initialization". */
function manualChunks(id: string) {
  if (id.indexOf("node_modules") < 0) return;
  if (
    id.indexOf("node_modules/react/") >= 0 ||
    id.indexOf("node_modules/react-dom/") >= 0 ||
    id.indexOf("node_modules/scheduler/") >= 0
  ) {
    return "react-vendor";
  }
  return "deps";
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: "es2020",
    sourcemap: false,
    /** `deps` chunk is three+r3f-heavy (~1.1 MB min); warn threshold is cosmetic for CI logs. */
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
});
