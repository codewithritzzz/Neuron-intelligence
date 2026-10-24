import { NextRequest, NextResponse } from "next/server";
import * as d from "@/lib/data";

export async function GET(req: NextRequest, { params }: { params: Promise<{ feature: string }> }) {
  const { feature } = await params;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  let data: unknown;
  switch (feature) {
    case "news": data = await d.getNews(); break;
    case "trends": data = await d.getTrends(); break;
    case "launches": data = await d.getLaunches(); break;
    case "robots": data = d.robots; break;
    case "tools": data = d.tools; break;
    case "search": data = q.length < 2 ? { local: [], web: [] } : await d.search(q); break;
    default: return NextResponse.json({ error: "Unknown feature" }, { status: 404 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=1200" } });
}
