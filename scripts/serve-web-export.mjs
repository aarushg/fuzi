import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "expo-app", "dist");
const indexFile = path.join(distDir, "index.html");
const port = Number(process.env.FUZI_WEB_PREVIEW_PORT || process.env.PORT || 8083);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function safeFilePath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0] || "/");
  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const resolvedPath = path.resolve(distDir, `.${requestedPath}`);
  return resolvedPath.startsWith(distDir) ? resolvedPath : "";
}

function serveFile(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const headers = {
    "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=31536000, immutable",
    "Content-Type": contentTypes[extension] || "application/octet-stream"
  };
  fs.createReadStream(filePath)
    .on("error", () => send(res, 500, "Failed to read web export.\n", { "Content-Type": "text/plain; charset=utf-8" }))
    .pipe(res.writeHead(200, headers));
}

function serveMaybeCompressed(req, res, filePath) {
  const acceptEncoding = String(req.headers["accept-encoding"] || "");
  const candidates = [
    { encoding: "br", path: `${filePath}.br`, accepted: /\bbr\b/.test(acceptEncoding) },
    { encoding: "gzip", path: `${filePath}.gz`, accepted: /\bgzip\b/.test(acceptEncoding) }
  ];
  const match = candidates.find((candidate) => candidate.accepted && fs.existsSync(candidate.path));
  if (!match) return serveFile(res, filePath);
  const extension = path.extname(filePath).toLowerCase();
  const headers = {
    "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=31536000, immutable",
    "Content-Encoding": match.encoding,
    "Content-Length": String(fs.statSync(match.path).size),
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Vary": "Accept-Encoding"
  };
  fs.createReadStream(match.path)
    .on("error", () => send(res, 500, "Failed to read web export.\n", { "Content-Type": "text/plain; charset=utf-8" }))
    .pipe(res.writeHead(200, headers));
}

if (!fs.existsSync(indexFile)) {
  console.error("Missing expo-app/dist/index.html. Run `npm run web:export` first.");
  process.exit(1);
}

http.createServer((req, res) => {
  const filePath = safeFilePath(req.url || "/");
  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return serveMaybeCompressed(req, res, filePath);
  }
  serveMaybeCompressed(req, res, indexFile);
}).listen(port, "0.0.0.0", () => {
  console.log(`FUZI exported single-page preview listening on http://127.0.0.1:${port}`);
  console.log("This is the same expo-app/dist/index.html bundle that production port 5000 serves.");
});
