// After build:
// 1. Patch wrangler.json: set run_worker_first=true so the Worker executes before
//    Cloudflare serves static assets. Measured on 2026-09-16: serving assets directly
//    (run_worker_first=["/"]) was no faster, and made /about answer 307 -> /about/.
//    Non-root paths on tree/pgp/gpg are also redirected by a zone Redirect Rule.
// 2. Wrap entry.mjs: non-root on tree/pgp/gpg -> www; tree / -> /tree; pgp/gpg / -> raw key.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = 'SUBDOMAIN_WORKER_WRAPPED_V4';

export default function pgpSubdomainWorkerEntry() {
  return {
    name: 'pgp-subdomain-worker-entry',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const serverDir = new URL('../server/', dir);

        // 1. Patch wrangler.json: add run_worker_first so the Worker runs before static assets
        const wranglerPath = fileURLToPath(new URL('wrangler.json', serverDir));
        const wrangler = JSON.parse(readFileSync(wranglerPath, 'utf8'));
        wrangler.assets ??= {};
        wrangler.assets.run_worker_first = true;
        writeFileSync(wranglerPath, JSON.stringify(wrangler));

        // 2. Wrap entry.mjs: tree / pgp / gpg subdomains before Astro handler
        const entryPath = fileURLToPath(new URL('entry.mjs', serverDir));
        let src = readFileSync(entryPath, 'utf8');
        if (src.includes(MARKER)) {
          return;
        }
        const m = src.match(/from\s+"(\.\/chunks\/worker-entry_[^"]+\.mjs)"/);
        if (!m) {
          throw new Error(
            'pgp-subdomain-worker-entry: could not find worker-entry chunk import in entry.mjs'
          );
        }
        const root = fileURLToPath(new URL('../../', import.meta.url));
        const keyPath = path.join(
          root,
          'key/publickey-v0id.me-6bec93c909633b56534e2dce1f4f0eda64619e19.asc'
        );
        const keyBody = readFileSync(keyPath, 'utf8');
        const chunkPath = m[1];
        src = `globalThis.process ??= {};
globalThis.process.env ??= {};
import "cloudflare:workers";
import { w } from "${chunkPath}";
// ${MARKER}
const PGP_RAW_PUBLIC = ${JSON.stringify(keyBody)};
const RAW_KEY_HOSTS = new Set(["pgp.v0id.me", "gpg.v0id.me"]);
const TREE_HOST = "tree.v0id.me";
const SUBDOMAIN_HOSTS = new Set(["tree.v0id.me", "pgp.v0id.me", "gpg.v0id.me"]);
const CANONICAL_WWW = "https://www.v0id.me";
const HASHED_RE = /^\\/_astro\\//;
const STATIC_EXT_RE = /\\.(?:svg|ico|webp|png|jpg|jpeg|gif|woff2?|ttf|otf|avif|mp4|webm)$/i;
function applyCacheAndClean(response, pathname) {
  const h = new Headers(response.headers);
  h.delete("Speculation-Rules");
  if (HASHED_RE.test(pathname)) {
    h.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (STATIC_EXT_RE.test(pathname) && pathname !== "/favicon.svg") {
    h.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  }
  // Web Key Directory: gpg --locate-keys hey@v0id.me fetches the key from here.
  if (pathname.startsWith("/.well-known/openpgpkey/")) {
    h.set("Content-Type", "application/octet-stream");
    h.set("Access-Control-Allow-Origin", "*");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}
// Visit count for the home page (src/lib/visits.ts): page loads by people, not the
// sidebar iframe, prefetches or bots. Each isolate adds up its visits and writes them
// at most every 10 seconds, since KV takes one write per key per second. Isolates that
// write at the same moment can overwrite each other, so the count is approximate.
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|curl|wget|httpie|python|go-http|headless|lighthouse|monitor/i;
let pendingVisits = 0;
let lastVisitFlush = 0;
let flushingVisits = false;
async function flushVisits(env) {
  const n = pendingVisits;
  pendingVisits = 0;
  try {
    const current = Number(await env.SESSION.get("visits")) || 0;
    await env.SESSION.put("visits", String(current + n));
  } catch {
    pendingVisits += n;
  } finally {
    lastVisitFlush = Date.now();
    flushingVisits = false;
  }
}
function countVisit(request, response, pathname, env, ctx) {
  if (!env.SESSION || request.method !== "GET" || response.status !== 200) return;
  if (!(response.headers.get("content-type") || "").startsWith("text/html")) return;
  if (pathname.startsWith("/now-playing") || pathname.startsWith("/admin")) return;
  const purpose = request.headers.get("sec-purpose") || request.headers.get("purpose") || "";
  if (purpose.includes("prefetch")) return;
  if (BOT_RE.test(request.headers.get("user-agent") || "")) return;
  pendingVisits++;
  if (flushingVisits || Date.now() - lastVisitFlush < 10000) return;
  flushingVisits = true;
  ctx.waitUntil(flushVisits(env));
}
export default {
  async fetch(request, env, ctx) {
    const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
    const url = new URL(request.url);
    if (host && SUBDOMAIN_HOSTS.has(host)) {
      const p = url.pathname;
      if (p !== "/" && p !== "") {
        const dest = new URL(CANONICAL_WWW);
        dest.pathname = url.pathname;
        dest.search = url.search;
        return Response.redirect(dest.toString(), 301);
      }
    }
    if (host === TREE_HOST && request.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
      url.pathname = "/tree";
      const r = await w.fetch(new Request(url.toString(), request), env, ctx);
      return applyCacheAndClean(r, "/tree");
    }
    if (host && RAW_KEY_HOSTS.has(host) && request.method === "GET") {
      if (url.pathname === "/" || url.pathname === "") {
        return new Response(PGP_RAW_PUBLIC, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }
    const r = await w.fetch(request, env, ctx);
    countVisit(request, r, url.pathname, env, ctx);
    return applyCacheAndClean(r, url.pathname);
  },
};
`;
        writeFileSync(entryPath, src);
      },
    },
  };
}
