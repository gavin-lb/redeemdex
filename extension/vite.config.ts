import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = resolve(__dirname);
const src = resolve(root, "src");

export default defineConfig({
  root: src,
  publicDir: resolve(root, "public"),
  build: {
    outDir: resolve(root, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        popup: resolve(src, "popup/index.html"),
        import: resolve(src, "import/index.html"),
        background: resolve(src, "background/index.ts"),
        content: resolve(src, "content/index.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
