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

- SSR iframe at /now-playing with meta refresh every 15 seconds. No client JS.
- Fetches from Spotify API server-side using refresh token flow.
- Secrets stored on Cloudflare Workers: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN.
- For local dev, secrets go in .dev.vars (gitignored).
- Progress bar is a static CSS width snapshot — no animation trickery.
- Pixel Spotify logo in public/spotify.svg.

## Laptop status

- Shown in the same /now-playing iframe, under the Spotify block, as a monospace block: `fahad active|away|inactive`, then laptop, claude sessions, and git rows. Iframe is 98px tall.
- The design was picked from several rounds of mockups. Change wording or layout only after showing variants.
- git row: src/lib/github.ts first lists every repo I committed to in the last year (mine and organizations'), keeps only public ones, then fetches my newest default-branch commit from those. GITHUB_TOKEN can read private repos, work ones included, so private repos are dropped before any commit data is fetched. Accounts listed in the GITHUB_SKIP_OWNERS secret are dropped too; the names live in the secret and .dev.vars, never in this repo. The lookup takes about 5 seconds, so it never runs while a reader waits: the answer is stored in KV under `github:latest` and refreshed through `Astro.locals.cfContext.waitUntil` after the response once it is older than 5 minutes. Only an empty KV makes a reader wait. The edge cache (caches.default) was tried first and never filled in production. The `x-git-cache` response header says fresh, stale, miss or off.
- Laptop and claude rows: scripts/presence.ts stays running on my Mac under launchd (scripts/me.v0id.presence.plist with KeepAlive, installed as ~/.local/bin/v0id-presence.ts). It reads the state every 10 seconds, compares it on the Mac, and POSTs to /presence only when it changed, plus a heartbeat every 15 minutes.
- scripts/presence-events.swift (compiled to ~/.local/bin/v0id-presence-events) reports macOS events. Lock, unlock and wake trigger a check at once. Before sleep, macOS waits (up to 10 seconds) while the reporter sends `asleep: true`, so the site shows sleep within seconds.
- Nothing may hang: every command is killed after 8 seconds, a check gives up after 20, the request after 15, and a watchdog exits the reporter when no check has finished for 90 seconds (it resets after sleep, when timers were paused). launchd then starts a fresh one. A request hung across sleep once kept the old interval job silent for a day.
- Sessions come from `claude agents --json`, which gives each local session's own busy or idle status. Sessions in hidden folders of my home (plugin helpers like ~/.claude-mem) are skipped. Cloud sessions are not counted: nothing on the Mac reports their status.
- `here` is decided on the Mac: away when the screen is locked, after 10 minutes without key or mouse input, or when the lid is closed with no external display. The Mac can be awake and reporting while I am away (caffeinate, the Claude app's keep-awake), so awake is not the same as here.
- Display: here shows `active` and the lid. Away shows `away` with `open, unattended` or `closed, kept awake`. Lid closed while here is the Mac used docked and shows `closed`.
- Every report is a detached OpenPGP signature by my key (the one in key/). src/pages/presence.ts verifies it with openpgp, loaded only on that route. No secret is stored on Cloudflare.
- The signed payload carries `for: "v0id.me/presence"` and `ts`. The endpoint rejects reports more than 2 minutes off, any ts not newer than the last one (no replay), and any extra field. `asleep` is optional so an older reporter still validates.
- Stored in the SESSION KV namespace under the key `presence`. An `asleep` report, or no report for 20 minutes (a crash, a dead battery), shows `inactive`. Reads use a 30-second KV cacheTtl, the lowest KV allows, and the iframe reloads every 15 seconds.
- After a reboot, gpg gets the passphrase from the login keychain through pinentry-mac, so the job keeps signing without a prompt.

## From a terminal

- Requests from curl, wget, HTTPie and xh (src/lib/terminal.ts) get plain text. src/middleware.ts sends `/` to src/pages/index.txt.ts: the pixel mark (public/favicon's shape in half blocks), the status block, the latest post and `curl v0id.me/posts`. `/` sends `Vary: User-Agent`. `/posts` lists every post for terminals and redirects browsers to `/`. The home page is rendered per request for this and for the visit count.
- `curl v0id.me` over plain http needs three things outside this repo: a Worker route `v0id.me/*` to peace-land (the apex is not one of the Worker's custom domains, only www, pgp, gpg and tree are), and the zone's apex to www redirect and http to https redirect both skipping curl and wget user agents. Redirect rules run before the Worker, so browsers still land on https://www.
- `/status` is the status block as plain text, in the same rows and columns as the iframe. The wording lives in src/lib/status.ts and both use it.
- `/status` and `/now-playing` send an `x-fahad: active|away|inactive` header.
- `/status.asc` is the laptop's last report exactly as signed, as one armored OpenPGP message: `curl -s https://www.v0id.me/status.asc | gpg --decrypt`. /presence keeps the signed body and signature in KV for this. The message is built by hand (one-pass header, literal data, signature) because openpgp.js `appendSignature` puts the signature first, which gpg rejects as an old PGP 2 message.
- Web Key Directory: `gpg --locate-keys hey@v0id.me` reads public/.well-known/openpgpkey (direct method). After changing the key: `gpg --export --export-options export-minimal --export-filter keep-uid=mbox=hey@v0id.me <fpr> > public/.well-known/openpgpkey/hu/$(gpg-wks-client --print-wkd-hash hey@v0id.me | cut -d' ' -f1)`.
- public/.well-known/security.txt is clearsigned with my key and expires 2027-10-19. Re-sign it with a new Expires before then: `gpg --clearsign`.

## Misc, guestbook and the rest

- The `misc` sidebar button, under tests, opens /misc: terminal commands grouped as status, keys and more. /uses and /colophon are linked from there and written from my public GitHub (setmac's configs are the source for /uses).
- /guestbook takes a plain form post or `curl -d name=… -d msg=… v0id.me/guestbook`, and `curl v0id.me/guestbook` reads it. Entries live in SESSION KV, one key each, with the entry in the key's metadata (src/lib/guestbook.ts). New ones wait under `gb:pending:` until I approve them with `bun run scripts/guestbook.ts`, which signs every request with my key like the presence reports (src/pages/guestbook/admin.ts checks the signature, a 2 minute window and a strictly increasing ts). One post a minute per visitor, a hidden field for bots, at most 100 waiting.
- Astro's checkOrigin is off because it refuses form posts without an Origin header, which is every curl post. The guestbook refuses a mismatched Origin itself and is the only route that takes form posts.
- Visit count next to rss: the Worker entry counts page loads by people (not bots, prefetches or the sidebar iframe) into KV key `visits`, batched per isolate and written at most every 10 seconds. Approximate by design.
- /favicon.svg is rendered per request: the pixel mark in black, gray when away, pale when inactive, cached 60 seconds.
- Link previews: /og.png for the site and /og/<slug>.png for posts, drawn on the Worker with resvg (WebAssembly, bundled; Workers cannot compile wasm at runtime) and DejaVu fonts served from public/og and fetched on first use. They show the status when the image was fetched; apps cache them.

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
