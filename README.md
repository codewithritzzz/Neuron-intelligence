# Neuron Intelligence (Next.js, step 1)

AI news, trends, launches, robotics and tools with a star-field background, star-written hero text, search, and a footer theme toggle (system by default, dark fallback).

## Run
    npm install
    cp .env.example .env.local   # keys are optional
    npm run dev                  # http://localhost:3000
    npm run build && npm start   # production

## API routes (server-side, cached 10 min, always fall back gracefully)
| Route | Sources (in order) |
|---|---|
| /api/news | NewsAPI (NEWS_API_KEY) -> GNews (GNEWS_API_KEY) -> Hacker News Algolia (no key) -> sample data |
| /api/trends | GitHub Search API (GITHUB_TOKEN optional) -> sample data |
| /api/launches | Product Hunt (PRODUCT_HUNT_TOKEN) + Hugging Face newest models (HF_TOKEN optional) -> sample data |
| /api/robots, /api/tools | data/robots.json, data/tools.json (curated, edit freely) |
| /api/search?q= | Local index (robots, tools, news, trends, launches) + Tavily web results (TAVILY_API_KEY) |

With no keys at all, news (Hacker News), trends (GitHub) and launches (Hugging Face) still load live.

## Notes
- Verify every robot link in data/robots.json before launch.
- NewsAPI's free plan is development-only; use a paid plan (or GNews) in production.
- Deploy: Vercel (import repo, add env vars) or any Node host (`npm run build && npm start`).
- Not built: Supabase, Upstash rate limiting, separate pages per section.

## NEURON: CYBERVERSE (3D open-world game)
A playable cyberpunk city: drive, transform your vehicle and fly between neon towers. Launch it from the home page button "NEURON: CYBERVERSE" (overlay) or open `/games/cyberverse` directly.
- Code lives in `components/games/cyberverse/` (plain three.js + custom physics, lazy-loaded so it adds nothing to the initial page weight).
- `city.ts` roads, buildings, signals, highway; `pois.ts` landmarks, pads, charging/repair/terminals; `vehicle.ts` driving, flight and transformation; `npc.ts` pedestrians and robots; `traffic.ts` lane-following traffic; `effects.ts` sky, rain, bloom; `audio.ts` synthesized sound; `ui.ts` HUD, minimap, map, menus, mobile controls; `game.ts` main loop.
- Controls: W/A/S/D drive, Space handbrake or ascend, X descend, Shift boost, C transform and land, F interact, V camera, R reset camera, M map, Esc pause.
- Graphics presets (Low / Medium / High) plus bloom, shadows, resolution, particles, view distance, crowd density and weather in Settings.
- Not included: Rapier/Zustand/React Three Fiber (replaced by lightweight custom code), tunnels, bridges, parking lots, dripping rain splashes, missions.
