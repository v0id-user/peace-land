# CLAUDE.md

## What this is

#V0ID's personal site and blog. Deployed on Cloudflare Workers. Costs $0/month.

## Stack

- Astro 6 with @astrojs/cloudflare adapter
- SSR mode (server output) — needed for Spotify now-playing and dynamic routes
- Shiki code highlighting (github-light theme)
- Sveltia CMS at /admin for editing (GitHub OAuth via separate sveltia-cms-auth worker)
- CI/CD: Cloudflare native Git integration — push to main auto-deploys. No GitHub Actions.

## Design rules

- PG-style (paulgraham.com). Verdana font, small text, gray sidebar buttons, underlined links.
- Zero client JavaScript shipped to readers. No exceptions.
- No Tailwind. Plain CSS only in src/styles/global.css.
- No frameworks, no component libraries, no build-time CSS tools.
- Default browser styling for interactive elements (links, buttons). Do not add custom hover effects or button styles unless specifically asked.
- Font sizes: h1 = 14px, h2 = 14px, body = 12-13px. Derive from tree page styling when adding new pages.
- Sidebar nav buttons: gray background, black when active. Post titles truncated to 24 chars.
- Layout: sidebar left, content right, max-width 960px, 16px left padding. Not edge-to-edge.

## Content collections

- `posts` — tech blog posts in src/content/posts/*.md. Frontmatter: title, date, slug.

## Human writings

- Personal writings are NOT in this repo. They live in the private repo v0id-user/peace-land-human (markdown files at repo root, frontmatter: title, date, slug).
- Served at request time: src/lib/human.ts fetches all files in one GitHub GraphQL call, parses frontmatter, renders markdown with marked. 60-second in-memory cache per isolate.
- Secret: GITHUB_TOKEN (read access to the private repo). Set on Cloudflare Workers; in .dev.vars for local dev.
- Behind two warning pages (/human → /human/confirm → /human/all). /human/all and /human/[slug] are prerender = false.
- Git history of this repo was rewritten on 2026-07-10 to remove src/content/human entirely. Do not re-add those files here.

## Spotify now-playing

- SSR iframe at /now-playing with meta refresh every 30 seconds. No client JS.
- Fetches from Spotify API server-side using refresh token flow.
- Secrets stored on Cloudflare Workers: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN.
- For local dev, secrets go in .dev.vars (gitignored).
- Progress bar is a static CSS width snapshot — no animation trickery.
- Pixel Spotify logo in public/spotify.svg.

## Laptop status

- Shown in the same /now-playing iframe, under the Spotify block, as a monospace block: `fahad active|away|inactive`, then laptop, claude sessions, and git rows. Iframe is 98px tall.
- The design was picked from several rounds of mockups. Change wording or layout only after showing variants.
- git row: src/lib/github.ts first lists every repo I committed to in the last year (mine and organizations'), keeps only public ones, then fetches my newest default-branch commit from those. GITHUB_TOKEN can read private repos, work ones included, so private repos are dropped before any commit data is fetched. Accounts listed in the GITHUB_SKIP_OWNERS secret are dropped too; the names live in the secret and .dev.vars, never in this repo. The lookup takes about 5 seconds, so it never runs while a reader waits: the answer sits in the edge cache (caches.default, no write limit, unlike KV) and is refreshed through waitUntil after the response once it is older than 5 minutes.
- Laptop and claude rows: scripts/presence.ts runs on my Mac every 30 seconds from launchd (scripts/me.v0id.presence.plist, installed from ~/.local/bin/v0id-presence.ts). It POSTs to /presence on change (at most every 40 seconds, up to 650 a day) and every 5 minutes as a heartbeat, which keeps KV under its 1,000 free writes a day.
- launchd never starts the job while a run is still alive, so one hung run stops all reports. Every run has a 50-second hard deadline and the request a 15-second timeout.
- Sessions come from `claude agents --json`, which gives each local session's own busy or idle status. Sessions in hidden folders of my home (plugin helpers like ~/.claude-mem) are skipped. Cloud sessions are not counted: nothing on the Mac reports their status.
- `here` is decided on the Mac: away when the screen is locked, after 10 minutes without key or mouse input, or when the lid is closed with no external display. The Mac can be awake and reporting while I am away (caffeinate, the Claude app's keep-awake), so awake is not the same as here.
- Display: here shows `active` and the lid. Away shows `away` with `open, unattended` or `closed, kept awake`. Lid closed while here is the Mac used docked and shows `closed`.
- Every report is a detached OpenPGP signature by my key (the one in key/). src/pages/presence.ts verifies it with openpgp, loaded only on that route. No secret is stored on Cloudflare.
- The signed payload carries `for: "v0id.me/presence"` and `ts`. The endpoint rejects reports more than 2 minutes off, any ts not newer than the last one (no replay), any extra field, and writes closer than 30 seconds apart.
- Stored in the SESSION KV namespace under the key `presence`. No report for 7 minutes means the laptop is asleep and the block shows `inactive`. Reads use a 30-second KV cacheTtl, the lowest KV allows.
- After a reboot, gpg gets the passphrase from the login keychain through pinentry-mac, so the job keeps signing without a prompt.

## CMS

- Sveltia CMS at /admin, restricted to GitHub user v0id-user.
- Auth handled by separate sveltia-cms-auth Cloudflare Worker.
- Config in public/admin/config.yml.
- CMS escapes backticks in code blocks — if a post from the CMS has broken code rendering, run: `sed -i '' 's/\\`/`/g' <file>` and remove blank lines inside code fences.

## Deployment

- Cloudflare Workers with native Git CI. Push to main = auto build + deploy.
- Build: `npm run build`
- Deploy config generated by Astro at dist/server/wrangler.json.
- Do NOT put a wrangler.toml or wrangler.jsonc at the project root — it conflicts with Astro's Cloudflare adapter.
- Do NOT create GitHub Actions for deployment — Cloudflare CI handles it.
- Do NOT deploy manually with wrangler unless explicitly asked.

## Routing

- /blog/* redirects to / with 301 (legacy URLs from old blog).
- /posts/[slug] renders blog posts.
- /human/[slug] renders personal writings.
- /now-playing is the Spotify iframe (not meant to be visited directly).

## Things to avoid

- No client-side JavaScript. Ever. If something needs interactivity, use SSR + page navigation or CSS.
- No wrangler config files at project root.
- No duplicate CI/CD pipelines.
- Do not over-style. When in doubt, use browser defaults.
- Do not add markdown, badges, or emojis to README. It's a plain .txt file.
- Verify changes locally before pushing. Use curl or preview tools to check deployed state.
- When the CMS mangles markdown (escaped backticks, blank lines in code blocks), fix the .md file directly.
