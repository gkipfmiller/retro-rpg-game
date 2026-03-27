import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const port = 4173;
const root = process.cwd();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer((req, res) => {
  const safePath = normalize(decodeURIComponent(req.url === "/" ? "/index.html" : req.url)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`Dungeon 30: The Abyssal Throne running at http://localhost:${port}`);
});
