import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function manualChunks(id: string) {
  if (id.indexOf("node_modules") < 0) return;

  if (
    id.indexOf("node_modules/react/") >= 0 ||
    id.indexOf("node_modules/react-dom/") >= 0 ||
    id.indexOf("node_modules/scheduler/") >= 0
  ) {
    return "react-vendor";
  }
  if (id.indexOf("node_modules/framer-motion") >= 0) {
    return "motion-vendor";
  }
  if (
    id.indexOf("node_modules/three") >= 0 ||
    id.indexOf("node_modules/@react-three/") >= 0 ||
    id.indexOf("node_modules/maath") >= 0
  ) {
    return "three-vendor";
  }
  if (id.indexOf("node_modules/zustand") >= 0) {
    return "zustand-vendor";
  }
  return "vendor";
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
    /** Three+r3f minified stays ~650–850 kB (gzip ~170–230 kB); default 500 kB limit is unrealistic here. */
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
});
