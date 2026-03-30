// After build:
// 1. Patch wrangler.json: set run_worker_first=true so the Worker executes before
//    Cloudflare serves static assets (default is false — assets served directly from CDN).
// 2. Wrap entry.mjs: intercept pgp/gpg subdomain hosts and return the raw armored key.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = 'PGP_SUBDOMAIN_ENTRY_WRAPPED';

export default function pgpSubdomainWorkerEntry() {
  return {
    name: 'pgp-subdomain-worker-entry',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const serverDir = new URL('../server/', dir);

        // 1. Patch wrangler.json — add run_worker_first so the Worker runs before static assets
        const wranglerPath = fileURLToPath(new URL('wrangler.json', serverDir));
        const wrangler = JSON.parse(readFileSync(wranglerPath, 'utf8'));
        wrangler.assets ??= {};
        wrangler.assets.run_worker_first = true;
        writeFileSync(wranglerPath, JSON.stringify(wrangler));

        // 2. Wrap entry.mjs — intercept pgp/gpg subdomain before Astro handler
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
export default {
  async fetch(request, env, ctx) {
    const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
    if (host && RAW_KEY_HOSTS.has(host) && request.method === "GET") {
      const url = new URL(request.url);
      if (url.pathname === "/" || url.pathname === "") {
        return new Response(PGP_RAW_PUBLIC, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
      return new Response("Not Found", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return w.fetch(request, env, ctx);
  },
};
`;
        writeFileSync(entryPath, src);
      },
    },
  };
}
