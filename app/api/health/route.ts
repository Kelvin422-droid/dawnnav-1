import { countLinks, ensureSeeded, readWebstack } from "@/lib/webstack";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    const data = await readWebstack();
    return Response.json({ status: "ok", framework: "Next.js", categories: data.length, links: countLinks(data) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ status: "error", error: error instanceof Error ? error.message : "未知错误" }, { status: 500 });
  }
}
