import {
  countLinks,
  ensureSeeded,
  readWebstack,
  replaceWebstack
} from "./database.js";
import { injectWebstack } from "./render.js";

const MAX_BODY_SIZE = 5 * 1024 * 1024;

function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

function canWrite(request, env) {
  if (!env.ADMIN_TOKEN) return true;
  return request.headers.get("x-admin-token") === env.ADMIN_TOKEN;
}

async function readJsonBody(request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_SIZE) throw new RangeError("请求数据超过 5 MB 限制");
  const text = await request.text();
  if (text.length > MAX_BODY_SIZE) throw new RangeError("请求数据超过 5 MB 限制");
  return JSON.parse(text);
}

async function renderHome(request, env) {
  const assetResponse = await env.ASSETS.fetch(request);
  if (!assetResponse.ok) return assetResponse;
  const data = await readWebstack(env.DB);
  const html = injectWebstack(await assetResponse.text(), data, request.url);
  const headers = new Headers(assetResponse.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(html, { status: assetResponse.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        await ensureSeeded(env.DB, env.ASSETS, request.url);
        const data = await readWebstack(env.DB);
        return json({ status: "ok", categories: data.length, links: countLinks(data) });
      }

      if (url.pathname === "/api/data" && request.method === "GET") {
        await ensureSeeded(env.DB, env.ASSETS, request.url);
        const data = await readWebstack(env.DB);
        return json(data, 200, { "X-Total-Count": String(countLinks(data)) });
      }

      if (url.pathname === "/api/save" && request.method === "POST") {
        if (!canWrite(request, env)) return json({ error: "管理令牌无效" }, 401);
        const body = await readJsonBody(request);
        const result = await replaceWebstack(env.DB, Array.isArray(body) ? body : body.data);
        return json({ success: true, count: result.links, ...result });
      }

      if ((url.pathname === "/" || url.pathname === "/index.html") && request.method === "GET") {
        await ensureSeeded(env.DB, env.ASSETS, request.url);
        return renderHome(request, env);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: error instanceof Error ? error.message : "服务器错误" }, error instanceof RangeError ? 413 : 500);
    }
  }
};
