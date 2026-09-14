import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = resolve(__dirname);
const src = resolve(root, "src");

export default defineConfig(({ mode }) => ({
  root: src,
  build: {
    outDir: resolve(root, "dist", mode),
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      input: resolve(src, "content/index.ts"),
      output: {
        entryFileNames: "content.js",
        format: "iife",
        inlineDynamicImports: true,
      },
    },
  },
}));
