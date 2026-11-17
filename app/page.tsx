import Background from "@/components/Background";
import CyberverseLauncher from "@/components/CyberverseLauncher";
import SearchPalette from "@/components/SearchPalette";
import ThemeToggle from "@/components/ThemeToggle";
import Tools from "@/components/Tools";
import Reveal from "@/components/Reveal";
import { Suspense } from "react";
import { getNews, trendsFeed, launchesFeed, robots, tools, type Item } from "@/lib/data";

export const revalidate = 1800;

const host = (u?: string) => { try { return new URL(u!).hostname; } catch { return ""; } };
const fmt = (d?: string) => { const t = d ? new Date(d) : null; return t && !isNaN(+t) ? t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : ""; };
const Thumb = ({ i }: { i: Item }) => (
  <div className="thumb">
    {i.image ? <img src={i.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : i.url ? <img className="fav" src={`https://www.google.com/s2/favicons?domain=${host(i.url)}&sz=128`} alt="" loading="lazy" /> : null}
  </div>
);
const Card = ({ i, lead }: { i: Item; lead?: boolean }) => {
  const when = i.date && fmt(i.date) ? `${i.label ?? "Published"} ${fmt(i.date)}` : "";
  const b = (<><Thumb i={i} />{i.tag && <span className="tag">{i.tag}</span>}<h3>{i.title}</h3>{i.summary && <p className="sm">{i.summary}</p>}<p className="mt">{[i.source, when, i.meta].filter(Boolean).join(" · ")}</p></>);
  const cls = `card rv${lead ? " lead" : ""}`;
  return i.url ? <a className={cls} href={i.url} target="_blank" rel="noopener noreferrer">{b}</a> : <div className={cls}>{b}</div>;
};
const Sec = ({ id, title, lead, live, children }: { id: string; title: string; lead: string; live?: boolean; children: React.ReactNode }) => (
  <section className="s" id={id}><h2>{title}{live && <span className="live">Live</span>}</h2><p className="lead">{lead}</p>{children}</section>
);
const Skeleton = () => (<div className="grid">{Array.from({ length: 6 }, (_, k) => <div key={k} className="card sk" aria-hidden="true"><div className="thumb" /><i /><i /><i style={{ width: "55%" }} /></div>)}</div>);
const State = ({ kind, msg }: { kind: "error" | "empty"; msg: string }) => <div className={`state ${kind}`} role={kind === "error" ? "alert" : undefined}>{msg}</div>;
async function TrendsGrid() {
  const f = await trendsFeed();
  if (!f.items.length) return <State kind={f.error ? "error" : "empty"} msg={f.error ?? "No trending AI stories right now. Check back soon."} />;
  return (<><div className="grid">{f.items.map((i, k) => <Card key={i.url ?? k} i={i} />)}</div><p className="src">Ranked by upvotes and recency from the last 3 days on Hacker News. Refreshed every 30 minutes.</p></>);
}
async function LaunchesGrid() {
  const f = await launchesFeed();
  if (!f.items.length) return <State kind={f.error ? "error" : "empty"} msg={f.error ?? "No new AI product launches found right now."} />;
  return (<><div className="grid">{f.items.map((i, k) => <Card key={i.url ?? k} i={i} />)}</div><p className="src">Sources: {f.sources?.join(", ")}. Dates are when each source published the item (&quot;Announced&quot; for company announcements), not guaranteed launch dates. Refreshed every 30 minutes.</p></>);
}
const st = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const socials = [
  { l: "Instagram", u: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://instagram.com/neuron.intelligence", s: <svg {...st}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" /></svg> },
  { l: "YouTube", u: process.env.NEXT_PUBLIC_YOUTUBE_URL, s: <svg {...st}><rect x="2" y="5" width="20" height="14" rx="4" /><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" /></svg> },
  { l: "LinkedIn", u: process.env.NEXT_PUBLIC_LINKEDIN_URL, s: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="5" r="2" /><rect x="3.2" y="9" width="3.6" height="12" /><path d="M10 9h3.4v1.7c.6-1.1 1.9-1.9 3.7-1.9 3 0 3.5 2 3.5 4.5V21h-3.6v-6c0-1.3-.2-2.8-1.8-2.8S13.6 13.7 13.6 15.1V21H10z" /></svg> },
  { l: "X", u: process.env.NEXT_PUBLIC_X_URL, s: <svg {...st}><path d="M4 4l16 16M20 4L4 20" /></svg> },
].filter((x) => x.u);

export default async function Home() {
  const news = await getNews();
  return (
    <>
      <Background /><Reveal />
      <nav>
        <a className="logo" href="#top"><img className="lg" src="/logo.png" alt="Neuron Intelligence logo" width={36} height={36} />Neuron Intelligence</a>
        <div className="links"><a href="#news">News</a><a href="#trends">Trends</a><a href="#launches">Launches</a><a href="#robotics">Robotics</a><a href="#tools">Tools</a></div>
        <SearchPalette />
      </nav>
      <main id="top">
        <div id="hero"><div className="stick">
          <canvas id="ht" aria-hidden="true" /><div className="gx"><div className="gal" /></div>
          <h1 className="sr">Neuron Intelligence</h1>
          <div className="hc">
            <p>News, trends, launches, robots and tools from across the AI universe, in one place.</p>
            <div className="row"><CyberverseLauncher /><a className="btn g" href="#news" style={{ textDecoration: "none", display: "grid", placeItems: "center" }}>Read the latest</a></div>
            <div className="sub">Drive, transform and fly through a living neon city.</div>
          </div>
        </div></div>
        <div className="tick" aria-hidden="true"><div className="tk">{[...news, ...news].map((n, k) => <span key={k}>{n.title}</span>)}</div></div>
        <Sec id="news" title="AI news" live lead="Breaking stories, company announcements and major developments.">
          {news.length ? <div className="grid">{news.map((i, k) => <Card key={i.url ?? k} i={i} lead={k === 0} />)}</div> : <State kind="empty" msg="No AI news available right now. Check back soon." />}
        </Sec>
        <Sec id="trends" title="Trends" live lead="The AI stories gaining the most attention right now."><Suspense fallback={<Skeleton />}><TrendsGrid /></Suspense></Sec>
        <Sec id="launches" title="Launches" live lead="New AI products, apps, agents and tools."><Suspense fallback={<Skeleton />}><LaunchesGrid /></Suspense></Sec>
        <Sec id="robotics" title="Robotics" lead="25 of the most talked-about robots and machines. Each card links to the official site.">
          <div className="grid">{robots.map((r) => <Card key={r.name} i={{ title: r.name, url: r.url, source: r.maker, tag: "Robot", meta: r.description }} />)}</div>
        </Sec>
        <Sec id="tools" title="Tools" lead="A starter directory of AI tools by category."><Tools tools={tools} /></Sec>
      </main>
      <footer>
        <div className="fg">
          <div><div className="logo"><img className="lg" src="/logo.png" alt="Neuron Intelligence logo" width={36} height={36} />Neuron Intelligence</div><p>AI trends, news, launches and future technology.</p></div>
          <div className="fl"><a href="#news">News</a><a href="#trends">Trends</a><a href="#launches">Launches</a><a href="#robotics">Robotics</a><a href="#tools">Tools</a></div>
          <div className="soc">{socials.map((x) => <a key={x.l} href={x.u} target="_blank" rel="noopener noreferrer" aria-label={`Neuron Intelligence on ${x.l}`}>{x.s}</a>)}</div>
        </div>
        <div className="cp"><span>© {new Date().getFullYear()} Neuron Intelligence. All rights reserved.</span><ThemeToggle /></div>
      </footer>
    </>
  );
}
