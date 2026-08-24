import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countLinks } from "./worker/webstack-data.js";
import { injectWebstack } from "./worker/render.js";
import {
  importYaml,
  openDatabase,
  readWebstack,
  replaceWebstack
} from "./lib/database.js";
import { loadEnvFile } from "./lib/env.js";

const root = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(root, ".env"));

const publicDirectory = path.join(root, "public");
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(root, "storage", "webstack.db");
const db = openDatabase(databasePath);
importYaml(db, path.join(root, "data", "webstack.yml"));

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8"
};

function sendJson(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  response.end(JSON.stringify(body));
}

function isLocalRequest(request) {
  const address = request.socket.remoteAddress || "";
  return address === "127.0.0.1" || address === "::1" || address.endsWith("127.0.0.1");
}

function canWrite(request) {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) return isLocalRequest(request);
  return request.headers["x-admin-token"] === configuredToken;
}

async function readJsonBody(request, maxBytes = 5 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("请求数据超过 5 MB 限制");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function resolveStaticPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, "");
  let target = path.resolve(publicDirectory, relative || "index.html");
  if (!target.startsWith(`${path.resolve(publicDirectory)}${path.sep}`) && target !== path.resolve(publicDirectory)) {
    return null;
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, "index.html");
  } else if (!path.extname(target) && fs.existsSync(`${target}.html`)) {
    target = `${target}.html`;
  } else if (!path.extname(target) && fs.existsSync(path.join(target, "index.html"))) {
    target = path.join(target, "index.html");
  }
  return target;
}

function sendStatic(request, response, pathname) {
  const target = resolveStaticPath(pathname);
  if (!target || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    sendJson(response, 404, { error: "页面不存在" });
    return;
  }

  const type = CONTENT_TYPES[path.extname(target).toLowerCase()] || "application/octet-stream";
  const headers = {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff"
  };

  if ((pathname === "/" || pathname === "/index.html") && type.startsWith("text/html")) {
    try {
      const requestUrl = `http://${request.headers.host || "127.0.0.1"}${pathname}`;
      const rendered = injectWebstack(
        fs.readFileSync(target, "utf8"),
        readWebstack(db),
        requestUrl
      );
      response.writeHead(200, { ...headers, "Cache-Control": "no-store" });
      response.end(rendered);
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return;
  }

  response.writeHead(200, {
    ...headers,
    "Cache-Control": type.startsWith("text/html") ? "no-cache" : "public, max-age=3600"
  });
  if (request.method === "HEAD") response.end();
  else fs.createReadStream(target).pipe(response);
}

export function createServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        const data = readWebstack(db);
        sendJson(response, 200, {
          status: "ok",
          categories: data.length,
          links: countLinks(data)
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/data") {
        const data = readWebstack(db);
        sendJson(response, 200, data, { "X-Total-Count": String(countLinks(data)) });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/save") {
        if (!canWrite(request)) {
          sendJson(response, 401, { error: "管理令牌无效或未配置" });
          return;
        }
        const body = await readJsonBody(request);
        const result = replaceWebstack(db, Array.isArray(body) ? body : body.data);
        sendJson(response, 200, { success: true, count: result.links, ...result });
        return;
      }

      if ((request.method === "GET" || request.method === "HEAD") && !url.pathname.startsWith("/api/")) {
        sendStatic(request, response, url.pathname);
        return;
      }

      sendJson(response, 404, { error: "接口不存在" });
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message });
    }
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT || 3000);
  const server = createServer();
  server.listen(port, host, () => {
    console.log(`DawnNav 动态服务已启动：http://${host}:${port}`);
    console.log(`管理页面：http://${host}:${port}/admin.html`);
  });

  const shutdown = () => server.close(() => {
    db.close();
    process.exit(0);
  });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
