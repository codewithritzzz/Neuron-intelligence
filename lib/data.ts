import robotsJson from "@/data/robots.json";
import toolsJson from "@/data/tools.json";
import sample from "@/data/sample.json";

export type Item = { title: string; url?: string; source: string; tag?: string; meta?: string };
export const robots = robotsJson as { name: string; maker: string; description: string; url: string }[];
export const tools = toolsJson as { name: string; category: string; url: string }[];

async function j<T>(url: string, init: RequestInit = {}): Promise<T | null> {
  try {
    const r = await fetch(url, { ...init, next: { revalidate: 600 } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}
const ago = (d: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
type Art = { articles?: { title: string; url: string; source: { name: string }; publishedAt: string }[] };
const arts = (d: Art | null): Item[] =>
  (d?.articles ?? []).map((a) => ({ title: a.title, url: a.url, source: a.source.name, tag: "News", meta: ago(a.publishedAt) }));

export async function getNews(): Promise<Item[]> {
  const nk = process.env.NEWS_API_KEY, gk = process.env.GNEWS_API_KEY;
  if (nk) {
    const r = arts(await j<Art>("https://newsapi.org/v2/everything?q=artificial%20intelligence&language=en&sortBy=publishedAt&pageSize=12", { headers: { "X-Api-Key": nk } }));
    if (r.length) return r;
  }
  if (gk) {
    const r = arts(await j<Art>(`https://gnews.io/api/v4/search?q=artificial%20intelligence&lang=en&max=12&apikey=${gk}`));
    if (r.length) return r;
  }
  const h = await j<{ hits: { title: string | null; url: string | null; objectID: string; created_at: string }[] }>(
    "https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=story&hitsPerPage=14");
  const hits = (h?.hits ?? []).filter((x) => x.title).slice(0, 12);
  if (hits.length)
    return hits.map((x) => ({ title: x.title!, url: x.url || `https://news.ycombinator.com/item?id=${x.objectID}`, source: "Hacker News", tag: "News", meta: ago(x.created_at) }));
  return sample.news;
}

export async function getTrends(): Promise<Item[]> {
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), t = process.env.GITHUB_TOKEN;
  const d = await j<{ items: { full_name: string; html_url: string; stargazers_count: number }[] }>(
    `https://api.github.com/search/repositories?q=topic:artificial-intelligence+created:>${since}&sort=stars&order=desc&per_page=9`,
    { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  const r = (d?.items ?? []).map((x) => ({ title: x.full_name, url: x.html_url, source: "GitHub", tag: "Rising repo", meta: `${x.stargazers_count.toLocaleString()} stars` }));
  return r.length ? r : sample.trends;
}

export async function getLaunches(): Promise<Item[]> {
  const out: Item[] = [];
  const pt = process.env.PRODUCT_HUNT_TOKEN, hf = process.env.HF_TOKEN;
  if (pt) {
    const d = await j<{ data: { posts: { edges: { node: { name: string; tagline: string; url: string } }[] } } }>("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${pt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: '{ posts(topic:"artificial-intelligence", order:NEWEST, first:6){ edges{ node{ name tagline url } } } }' }),
    });
    for (const e of d?.data?.posts?.edges ?? []) out.push({ title: e.node.name, url: e.node.url, source: "Product Hunt", tag: "Product", meta: e.node.tagline });
  }
  const m = await j<{ id: string }[]>("https://huggingface.co/api/models?sort=createdAt&direction=-1&limit=8", { headers: hf ? { Authorization: `Bearer ${hf}` } : {} });
  for (const x of m ?? []) out.push({ title: x.id, url: `https://huggingface.co/${x.id}`, source: "Hugging Face", tag: "Model" });
  return out.length ? out : sample.launches;
}

export async function search(q: string): Promise<{ local: Item[]; web: Item[] }> {
  const s = q.toLowerCase(), has = (i: Item) => `${i.title} ${i.meta ?? ""}`.toLowerCase().includes(s);
  const [n, t, l] = await Promise.all([getNews(), getTrends(), getLaunches()]);
  const local = [
    ...robots.map((r) => ({ title: `${r.name} · ${r.maker}`, url: r.url, source: "Robotics", tag: "Robot", meta: r.description })),
    ...tools.map((x) => ({ title: x.name, url: x.url, source: "Tools", tag: x.category })),
    ...n, ...t, ...l,
  ].filter(has).slice(0, 12);
  let web: Item[] = [];
  const key = process.env.TAVILY_API_KEY;
  if (key) {
    const d = await j<{ results: { title: string; url: string; content: string }[] }>("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: q, max_results: 6 }),
    });
    web = (d?.results ?? []).map((r) => ({ title: r.title, url: r.url, source: new URL(r.url).hostname, tag: "Web", meta: r.content.slice(0, 120) }));
  }
  return { local, web };
}
