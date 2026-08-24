import { countLinks, ensureSeeded, readWebstack } from "@/lib/webstack";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    const data = await readWebstack();
    return Response.json(data, {
      headers: {
        "Cache-Control": "no-store",
        "X-Total-Count": String(countLinks(data)),
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "读取数据失败" }, { status: 500 });
  }
}
