const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

http
  .createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }
    let file;
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      file = path.resolve(
        root,
        "." +
          decodeURIComponent(
            url.pathname === "/" ? "/index.html" : url.pathname,
          ),
      );
      if (!file.startsWith(root + path.sep)) throw new Error("Invalid path");
    } catch {
      response.writeHead(400);
      response.end("Invalid path");
      return;
    }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Content-Length": stat.size,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      if (request.method === "HEAD") response.end();
      else
        fs.createReadStream(file)
          .on("error", () => response.destroy())
          .pipe(response);
    });
  })
  .on("error", (error) => {
    console.error(`Could not start Cashflow: ${error.message}`);
    process.exitCode = 1;
  })
  .listen(4173, "127.0.0.1", () => {
    console.log(
      "Cashflow: http://127.0.0.1:4173\nKeep this window open while playing. Press Ctrl+C to stop.",
    );
  });
