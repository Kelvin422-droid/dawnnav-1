import { env } from "cloudflare:workers";
import { replaceWebstack } from "@/lib/webstack";

export const dynamic = "force-dynamic";
const MAX_BODY_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const expectedToken = typeof env.ADMIN_TOKEN === "string" ? env.ADMIN_TOKEN : "";
    if (expectedToken && request.headers.get("x-admin-token") !== expectedToken) {
      return Response.json({ error: "管理令牌无效" }, { status: 401 });
    }
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_BODY_SIZE) throw new RangeError("请求数据超过 5 MB 限制");
    const text = await request.text();
    if (text.length > MAX_BODY_SIZE) throw new RangeError("请求数据超过 5 MB 限制");
    const body = JSON.parse(text) as { data?: unknown } | unknown[];
    const result = await replaceWebstack(Array.isArray(body) ? body : body.data);
    return Response.json({ success: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    const status = error instanceof RangeError ? 413 : error instanceof SyntaxError || error instanceof TypeError ? 400 : 500;
    return Response.json({ error: error instanceof Error ? error.message : "保存失败" }, { status });
  }
}
