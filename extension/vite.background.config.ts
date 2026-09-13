import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = resolve(__dirname);
const src = resolve(root, "src");

export default defineConfig({
  root: src,
  build: {
    outDir: resolve(root, "dist"),
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      input: resolve(src, "background/index.ts"),
      output: {
        entryFileNames: "background.js",
        format: "iife",
        inlineDynamicImports: true,
      },
    },
  },
});
