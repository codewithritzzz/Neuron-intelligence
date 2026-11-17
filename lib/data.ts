import { cache } from "react";
import robotsJson from "@/data/robots.json";
import toolsJson from "@/data/tools.json";
import sample from "@/data/sample.json";
import type { Item, Feed } from "./types";
import { rssNews, trendsFeed as trendsRaw, launchesFeed as launchesRaw, pageMeta } from "./feeds";

export type { Item, Feed };
export const robots = robotsJson as { name: string; maker: string; description: string; url: string }[];
export const tools = toolsJson as { name: string; category: string; url: string }[];

type Art = { articles?: { title: string; url: string; source: { name: string }; publishedAt: string; description?: string | null; urlToImage?: string | null; image?: string | null }[] };
const arts = (d: Art | null): Item[] => (d?.articles ?? []).map((a) => ({ title: a.title, url: a.url, source: a.source.name, tag: "News", date: a.publishedAt, summary: a.description ?? undefined, image: a.urlToImage || a.image || undefined }));
async function json<T>(url: string, init: RequestInit = {}): Promise<T | null> {
  try { const r = await fetch(url, { ...init, next: { revalidate: 1800 } }); return r.ok ? ((await r.json()) as T) : null; } catch { return null; }
}

/** AI news: NewsAPI or GNews when a key is set, otherwise public RSS feeds from AI news outlets. */
export const getNews = cache(async (): Promise<Item[]> => {
  const nk = process.env.NEWS_API_KEY, gk = process.env.GNEWS_API_KEY;
  if (nk) { const r = arts(await json<Art>("https://newsapi.org/v2/everything?q=artificial%20intelligence&language=en&sortBy=publishedAt&pageSize=12", { headers: { "X-Api-Key": nk } })); if (r.length) return r; }
  if (gk) { const r = arts(await json<Art>(`https://gnews.io/api/v4/search?q=artificial%20intelligence&lang=en&max=12&apikey=${gk}`)); if (r.length) return r; }
  const r = await rssNews();
  return r.length ? r : sample.news;
});
export const trendsFeed = cache(trendsRaw);
export const launchesFeed = cache(launchesRaw);
export const getTrends = async () => (await trendsFeed()).items;
export const getLaunches = async () => (await launchesFeed()).items;

export async function search(q: string): Promise<{ local: Item[]; web: Item[] }> {
  const s = q.toLowerCase(), has = (i: Item) => `${i.title} ${i.summary ?? ""} ${i.meta ?? ""}`.toLowerCase().includes(s);
  const [n, t, l] = await Promise.all([getNews(), getTrends(), getLaunches()]);
  const local = [
    ...robots.map((r) => ({ title: `${r.name} · ${r.maker}`, url: r.url, source: "Robotics", tag: "Robot", meta: r.description })),
    ...tools.map((x) => ({ title: x.name, url: x.url, source: "Tools", tag: x.category })),
    ...n, ...t, ...l,
  ].filter(has).slice(0, 12);
  let web: Item[] = [];
  const key = process.env.TAVILY_API_KEY;
  if (key) {
    const d = await json<{ results: { title: string; url: string; content: string }[] }>("https://api.tavily.com/search", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: q, max_results: 6 }) });
    web = (d?.results ?? []).map((r) => ({ title: r.title, url: r.url, source: new URL(r.url).hostname, tag: "Web", meta: r.content.slice(0, 120) }));
  }
  return { local, web };
}
void pageMeta;
