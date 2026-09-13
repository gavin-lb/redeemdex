#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../dist/", import.meta.url)));

// The server serves the Vite production output. Run `npm run build:mock`
// before starting it (the `serve` script does this automatically).
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8000);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function safePath(urlPath: string): string | null {
  const pathname = decodeURIComponent(new URL(urlPath, `http://${HOST}:${PORT}`).pathname);
  const requestedPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = resolve(ROOT, requestedPath);

  if (file !== ROOT && !file.startsWith(`${ROOT}${process.platform === "win32" ? "\\" : "/"}`)) {
    return null;
  }

  return file;
}

const server = createServer(async (request, response) => {
  try {
    const file = safePath(request.url ?? "/");
    if (!file) {
      response.writeHead(403, { "Cache-Control": "no-store" });
      response.end("Forbidden");
      return;
    }

    let requestedFile = file;

    // The mock is a single-page application. Serve index.html for the root
    // and for extension test routes rather than returning a bare 404.
    try {
      const info = await stat(requestedFile);
      if (!info.isFile()) throw new Error("Not a file");
    } catch {
      requestedFile = join(ROOT, "index.html");
      const info = await stat(requestedFile);
      if (!info.isFile()) throw new Error("index.html is missing");
    }

    const info = await stat(requestedFile);
    if (!info.isFile()) throw new Error("Not a file");

    response.writeHead(200, {
      "Content-Type":
        MIME_TYPES[extname(requestedFile).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(requestedFile).pipe(response);
  } catch {
    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end("Not found");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`PTCGL mock running at http://${HOST}:${PORT}/`);
  console.log("No requests are sent to Pokémon servers.");
});
