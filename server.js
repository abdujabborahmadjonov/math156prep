// A small static file server for hosting the site as a web service (LivOps or any Node host).
// No dependencies: run `node server.js`. It listens on $PORT, or 3000.

const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};
const COMPRESS = new Set([".html", ".js", ".css", ".json", ".svg", ".txt", ".md"]);
const HIDDEN = new Set(["server.js", "package.json"]);

// Files are read once and kept in memory, with a gzip copy for text.
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const body = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const entry = { body, gz: COMPRESS.has(ext) ? zlib.gzipSync(body, { level: 9 }) : null, type: TYPES[ext] || "application/octet-stream", ext };
  cache.set(file, entry);
  return entry;
}

function send(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" });
  res.end(text);
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");

  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch (e) { return send(res, 400, "Bad request"); }
  if (pathname.endsWith("/")) pathname += "index.html";

  const file = path.join(ROOT, path.normalize(pathname));
  const inside = file.startsWith(ROOT + path.sep);
  const hidden = pathname.split("/").some((part) => part.startsWith(".")) || HIDDEN.has(path.relative(ROOT, file));
  if (!inside || hidden) return send(res, 404, "Not found");

  let entry;
  try {
    if (!fs.statSync(file).isFile()) return send(res, 404, "Not found");
    entry = load(file);
  } catch (e) {
    return send(res, 404, "Not found");
  }

  const gzip = entry.gz && /\bgzip\b/.test(req.headers["accept-encoding"] || "");
  const body = gzip ? entry.gz : entry.body;
  const headers = {
    "Content-Type": entry.type,
    "Content-Length": body.length,
    "X-Content-Type-Options": "nosniff",
    // Pages and scripts are checked on every visit, so updates show at once; fonts change rarely.
    "Cache-Control": entry.ext === ".woff2" ? "public, max-age=604800" : "no-cache",
    "Vary": "Accept-Encoding",
  };
  if (gzip) headers["Content-Encoding"] = "gzip";
  res.writeHead(200, headers);
  res.end(req.method === "HEAD" ? undefined : body);
});

server.listen(PORT, () => console.log(`MATH 156 prep is being served on port ${PORT}`));
