// Free, keyless sources only: public RSS/Atom feeds, the Hacker News (Algolia) API and the GitHub search API.
// Everything runs on the server and is cached by Next.js for 30 minutes (page-level ISR plus fetch cache).
import type { Item, Feed } from "./types";

const UA = "Mozilla/5.0 (compatible; NeuronIntelligenceBot/1.0; +https://github.com/codewithritzzz/Neuron-intelligence)";
const REVAL = 1800;

async function fetchText(url: string, revalidate = REVAL, timeout = 6000, init: RequestInit = {}): Promise<string | null> {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, application/json;q=0.9, */*;q=0.8", ...(init.headers ?? {}) }, next: { revalidate } });
    return r.ok ? await r.text() : null;
  } catch { return null; } finally { clearTimeout(timer); }
}
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const t = await fetchText(url, REVAL, 6000, init); if (!t) return null;
  try { return JSON.parse(t) as T; } catch { return null; }
}

// ---------- tiny RSS/Atom parser ----------
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
  if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
export const strip = (s = "") => decode(decode(s).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const tag = (xml: string, name: string) => new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(xml)?.[1];
const iso = (s?: string) => { if (!s) return undefined; const d = new Date(strip(s)); return isNaN(+d) ? undefined : d.toISOString(); };
export const host = (u?: string) => { try { return new URL(u!).hostname.replace(/^www\./, ""); } catch { return ""; } };

export interface RawItem { title: string; url: string; date?: string; summary?: string; image?: string }
export function parseFeed(xml: string): RawItem[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  const out: RawItem[] = [];
  for (const b of blocks) {
    const title = strip(tag(b, "title") ?? ""); let url: string | undefined;
    for (const m of b.matchAll(/<link\b([^>]*?)\/?>/gi)) { const h = /href=["']([^"']+)["']/i.exec(m[1])?.[1], rel = /rel=["']([^"']+)["']/i.exec(m[1])?.[1]; if (h && (!rel || rel === "alternate")) { url = decode(h); break; } }
    if (!url) { const t = tag(b, "link"); if (t) url = strip(t); }
    if (!url) { const g = tag(b, "guid"); if (g && /^https?:/i.test(strip(g))) url = strip(g); }
    if (!title || !url) continue;
    const body = tag(b, "content:encoded") ?? tag(b, "content") ?? tag(b, "description") ?? tag(b, "summary") ?? "";
    let image: string | undefined;
    for (const m of b.matchAll(/<media:(?:content|thumbnail)\b[^>]*?url=["']([^"']+)["'][^>]*>/gi)) { if (/(?:type|medium)=["']video/i.test(m[0])) continue; image = decode(m[1]); break; }
    if (!image) image = (/<enclosure\b[^>]*?url=["']([^"']+)["'][^>]*?type=["']image/i.exec(b) ?? /<enclosure\b[^>]*?type=["']image[^"']*["'][^>]*?url=["']([^"']+)["']/i.exec(b))?.[1];
    if (!image) image = /<img[^>]+src=["']([^"']+)["']/i.exec(decode(body))?.[1];
    out.push({ title, url, date: iso(tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated") ?? tag(b, "dc:date")), summary: strip(body).slice(0, 220) || undefined, image: image && /^https:\/\//i.test(image) ? image : undefined });
  }
  return out;
}

/** Best-effort page metadata (og:image / description). Cached 24h, 3.5s timeout, never throws. */
export async function pageMeta(url: string): Promise<{ image?: string; description?: string }> {
  if (!/^https?:/i.test(url) || url.includes("news.ycombinator.com")) return {};
  const html = await fetchText(url, 86400, 3500); if (!html) return {};
  const head = html.slice(0, 150000);
  const meta = (p: string) => { const m = new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']*)["']`, "i").exec(head) ?? new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${p}["']`, "i").exec(head); return m ? decode(m[1]) : undefined; };
  let image = meta("og:image") ?? meta("twitter:image");
  try { if (image) image = new URL(image, url).href; } catch { image = undefined; }
  if (image && !image.startsWith("https://")) image = undefined;
  const d = meta("og:description") ?? meta("description");
  return { image, description: d ? strip(d).slice(0, 220) : undefined };
}
async function enrich(items: Item[], max = 12): Promise<Item[]> {
  return Promise.all(items.map(async (i, n) => {
    if (n >= max || !i.url || (i.image && i.summary)) return i;
    const m = await pageMeta(i.url);
    return { ...i, image: i.image ?? m.image, summary: i.summary ?? m.description };
  }));
}
const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60);
function dedupe(items: Item[]) { const seen = new Set<string>(); return items.filter((i) => { const k = key(i.title); if (seen.has(k)) return false; seen.add(k); return true; }); }
const byDate = (a: Item, b: Item) => +new Date(b.date ?? 0) - +new Date(a.date ?? 0);

export const AI_RE = /\b(ai|a\.i\.|artificial intelligence|llms?|gpt\w*|chatgpt|openai|anthropic|claude|gemini|deepseek|mistral|llama|machine learning|neural|diffusion|copilot|agentic|agents?|robots?|nvidia|transformers?|generative|deep learning|rag|inference|sora|midjourney|grok)\b/i;

// ---------- AI news from public outlet feeds (used when no NewsAPI/GNews key is configured) ----------
const NEWS_FEEDS: [string, string][] = [
  ["TechCrunch", "https://techcrunch.com/category/artificial-intelligence/feed/"],
  ["The Verge", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"],
  ["VentureBeat", "https://venturebeat.com/category/ai/feed/"],
  ["MIT Technology Review", "https://www.technologyreview.com/topic/artificial-intelligence/feed"],
  ["Ars Technica", "https://arstechnica.com/ai/feed/"],
];
export async function rssNews(): Promise<Item[]> {
  const res = await Promise.all(NEWS_FEEDS.map(async ([source, url]) => { const x = await fetchText(url); return x ? parseFeed(x).slice(0, 8).map((r): Item => ({ title: r.title, url: r.url, source, tag: "News", date: r.date, summary: r.summary, image: r.image })) : []; }));
  const items = dedupe(res.flat().sort(byDate)).slice(0, 12);
  return enrich(items);
}

// ---------- Trends: AI stories ranked by upvotes and recency (Hacker News) ----------
interface Hit { objectID: string; title?: string; url?: string | null; points?: number; num_comments?: number; created_at_i: number }
export async function trendsFeed(): Promise<Feed> {
  const now = Math.floor(Date.now() / 1000), since = now - 3 * 86400;
  const qs = ["AI", "LLM", "OpenAI", "Anthropic", "machine learning", "AI agents"];
  const res = await Promise.all(qs.map((q) => fetchJson<{ hits: Hit[] }>(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&numericFilters=created_at_i>${since},points>15&hitsPerPage=25`)));
  if (res.every((r) => !r)) return { items: [], error: "Hacker News is not responding right now. Please try again in a few minutes." };
  const map = new Map<string, Hit>();
  for (const r of res) for (const h of r?.hits ?? []) if (h.title && !map.has(h.objectID) && AI_RE.test(`${h.title} ${h.url ?? ""}`)) map.set(h.objectID, h);
  const ranked = [...map.values()].map((h) => ({ h, s: (h.points ?? 0) / Math.pow((now - h.created_at_i) / 3600 + 2, 1.4) })).sort((a, b) => b.s - a.s).slice(0, 12);
  const items: Item[] = ranked.map(({ h }) => ({ title: h.title!, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, source: host(h.url ?? "") || "Hacker News", tag: "Trending", date: new Date(h.created_at_i * 1000).toISOString(), meta: `▲ ${h.points ?? 0} · ${h.num_comments ?? 0} comments`, label: "Published" }));
  return { items: await enrich(items), sources: ["Hacker News"] };
}

// ---------- Launches: new AI products and tools ----------
const ANNOUNCE_RE = /\b(introduc\w*|launch\w*|releas\w*|announc\w*|unveil\w*|debut\w*|now available|rolls? out|available today|preview)\b/i;
export function categorize(text: string): string {
  if (/\b(code|coding|developers?|ide|programming|copilot|devtools?|sdk|cli|compiler|debug\w*)\b/i.test(text)) return "Coding tools";
  if (/\b(agents?|agentic|automation|automate|workflows?|orchestrat\w*)\b/i.test(text)) return "Agents & automation";
  if (/\b(image|video|design|music|audio|art|creative|photo|3d|voice|animation|generat\w*)\b/i.test(text)) return "Creative tools";
  if (/\b(productivity|notes?|meetings?|email|writing|calendar|summar\w*|assistant|search|chat)\b/i.test(text)) return "Productivity";
  return "AI product";
}
const MIN_STARS = 60;
export async function launchesFeed(): Promise<Feed> {
  const now = Date.now(), since14 = Math.floor(now / 1000) - 14 * 86400, d21 = new Date(now - 21 * 86400e3).toISOString().slice(0, 10), gh = process.env.GITHUB_TOKEN;
  const ghInit: RequestInit = gh ? { headers: { Authorization: `Bearer ${gh}` } } : {};
  const [ph, show, oai, goog, g1, g2] = await Promise.all([
    fetchText("https://www.producthunt.com/feed?category=artificial-intelligence"),
    fetchJson<{ hits: Hit[] }>(`https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=show_hn&numericFilters=created_at_i>${since14},points>5&hitsPerPage=40`),
    fetchText("https://openai.com/news/rss.xml"),
    fetchText("https://blog.google/technology/ai/rss/"),
    fetchJson<{ items: { full_name: string; description: string | null; html_url: string; created_at: string }[] }>(`https://api.github.com/search/repositories?q=topic:llm+created:>${d21}+stars:>${MIN_STARS}&sort=stars&order=desc&per_page=5`, ghInit),
    fetchJson<{ items: { full_name: string; description: string | null; html_url: string; created_at: string }[] }>(`https://api.github.com/search/repositories?q=topic:ai-agents+created:>${d21}+stars:>${MIN_STARS}&sort=stars&order=desc&per_page=5`, ghInit),
  ]);
  const sources: string[] = [], groups: Item[][] = [];
  if (ph) { const it = parseFeed(ph).slice(0, 5).map((r): Item => ({ title: r.title, url: r.url, source: "Product Hunt", date: r.date, summary: r.summary?.replace(/\s*Discussion\s*\|\s*Link\s*$/i, ""), image: r.image, label: "Published", tag: categorize(`${r.title} ${r.summary ?? ""}`) })); if (it.length) { groups.push(it); sources.push("Product Hunt"); } }
  if (show?.hits?.length) {
    const it = show.hits.filter((h) => h.title && /^show hn/i.test(h.title) && AI_RE.test(h.title)).slice(0, 4).map((h): Item => {
      const t = h.title!.replace(/^show hn:?\s*/i, ""), cut = t.search(/\s[–—-]\s|:\s/), name = cut > 0 ? t.slice(0, cut) : t, desc = cut > 0 ? t.slice(cut).replace(/^\s*[–—:-]\s*/, "") : undefined;
      return { title: name, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, source: host(h.url ?? "") || "Hacker News", summary: desc, date: new Date(h.created_at_i * 1000).toISOString(), meta: `▲ ${h.points ?? 0} on Show HN`, label: "Published", tag: categorize(h.title!) };
    });
    if (it.length) { groups.push(it); sources.push("Show HN"); }
  }
  for (const [name, xml] of [["OpenAI", oai], ["Google AI", goog]] as [string, string | null][]) {
    if (!xml) continue;
    const it = parseFeed(xml).filter((r) => ANNOUNCE_RE.test(r.title)).slice(0, 3).map((r): Item => ({ title: r.title, url: r.url, source: name, date: r.date, summary: r.summary, image: r.image, label: "Announced", tag: categorize(`${r.title} ${r.summary ?? ""}`) }));
    if (it.length) { groups.push(it); sources.push(name); }
  }
  const repos = [...(g1?.items ?? []), ...(g2?.items ?? [])];
  if (repos.length) {
    const seen = new Set<string>(), it = repos.filter((r) => !seen.has(r.full_name) && seen.add(r.full_name)).slice(0, 4).map((r): Item => ({ title: r.full_name, url: r.html_url, source: "GitHub", date: r.created_at, summary: r.description ?? undefined, image: `https://opengraph.githubassets.com/1/${r.full_name}`, label: "Published", tag: "Open source" }));
    groups.push(it); sources.push("GitHub");
  }
  if (!groups.length) return { items: [], error: "The product launch sources are not responding right now. Please try again in a few minutes." };
  const items = dedupe(groups.flat().sort(byDate)).slice(0, 12);
  return { items: await enrich(items), sources };
}
