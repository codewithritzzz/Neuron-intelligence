import Background from "@/components/Background";
import CyberverseLauncher from "@/components/CyberverseLauncher";
import SearchPalette from "@/components/SearchPalette";
import ThemeToggle from "@/components/ThemeToggle";
import Tools from "@/components/Tools";
import Reveal from "@/components/Reveal";
import { getNews, getTrends, getLaunches, robots, tools, type Item } from "@/lib/data";

export const revalidate = 600;

const host = (u?: string) => { try { return new URL(u!).hostname; } catch { return ""; } };
const Thumb = ({ i }: { i: Item }) => (
  <div className="thumb">
    {i.image ? <img src={i.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : i.url ? <img className="fav" src={`https://www.google.com/s2/favicons?domain=${host(i.url)}&sz=128`} alt="" loading="lazy" /> : null}
  </div>
);
const Card = ({ i }: { i: Item }) => {
  const b = (<><Thumb i={i} />{i.tag && <span className="tag">{i.tag}</span>}<h3>{i.title}</h3><p>{[i.source, i.meta].filter(Boolean).join(" · ")}</p></>);
  return i.url
    ? <a className="card rv" href={i.url} target="_blank" rel="noopener noreferrer">{b}</a>
    : <div className="card rv">{b}</div>;
};
const Sec = ({ id, title, lead, children }: { id: string; title: string; lead: string; children: React.ReactNode }) => (
  <section className="s" id={id}><h2>{title}</h2><p className="lead">{lead}</p>{children}</section>
);
const st = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const socials = [
  { l: "Instagram", u: process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://instagram.com/neuron.intelligence", s: <svg {...st}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" /></svg> },
  { l: "YouTube", u: process.env.NEXT_PUBLIC_YOUTUBE_URL, s: <svg {...st}><rect x="2" y="5" width="20" height="14" rx="4" /><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" /></svg> },
  { l: "LinkedIn", u: process.env.NEXT_PUBLIC_LINKEDIN_URL, s: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="5" r="2" /><rect x="3.2" y="9" width="3.6" height="12" /><path d="M10 9h3.4v1.7c.6-1.1 1.9-1.9 3.7-1.9 3 0 3.5 2 3.5 4.5V21h-3.6v-6c0-1.3-.2-2.8-1.8-2.8S13.6 13.7 13.6 15.1V21H10z" /></svg> },
  { l: "X", u: process.env.NEXT_PUBLIC_X_URL, s: <svg {...st}><path d="M4 4l16 16M20 4L4 20" /></svg> },
].filter((x) => x.u);

export default async function Home() {
  const [news, trends, launches] = await Promise.all([getNews(), getTrends(), getLaunches()]);
  return (
    <>
      <Background /><Reveal />
      <nav>
        <a className="logo" href="#top"><img className="lg" src="/logo.png" alt="" height={32} />Neuron Intelligence</a>
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
        <Sec id="news" title="AI news" lead="Breaking stories, company announcements and major developments."><div className="grid">{news.map((i, k) => <Card key={k} i={i} />)}</div></Sec>
        <Sec id="trends" title="Trends" lead="What is gaining momentum across the industry."><div className="grid">{trends.map((i, k) => <Card key={k} i={i} />)}</div></Sec>
        <Sec id="launches" title="Launches" lead="New models, products, apps and platforms."><div className="grid">{launches.map((i, k) => <Card key={k} i={i} />)}</div></Sec>
        <Sec id="robotics" title="Robotics" lead="25 of the most talked-about robots and machines. Each card links to the official site.">
          <div className="grid">{robots.map((r) => <Card key={r.name} i={{ title: r.name, url: r.url, source: r.maker, tag: "Robot", meta: r.description }} />)}</div>
        </Sec>
        <Sec id="tools" title="Tools" lead="A starter directory of AI tools by category."><Tools tools={tools} /></Sec>
      </main>
      <footer>
        <div className="fg">
          <div><div className="logo"><img className="lg" src="/logo.png" alt="" height={32} />Neuron Intelligence</div><p>AI trends, news, launches and future technology.</p></div>
          <div className="fl"><a href="#news">News</a><a href="#trends">Trends</a><a href="#launches">Launches</a><a href="#robotics">Robotics</a><a href="#tools">Tools</a></div>
          <div className="soc">{socials.map((x) => <a key={x.l} href={x.u} target="_blank" rel="noopener noreferrer" aria-label={`Neuron Intelligence on ${x.l}`}>{x.s}</a>)}</div>
        </div>
        <div className="cp"><span>© {new Date().getFullYear()} Neuron Intelligence. All rights reserved.</span><ThemeToggle /></div>
      </footer>
    </>
  );
}
