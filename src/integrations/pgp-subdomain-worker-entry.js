/**
 * After build, wrap dist/server/entry.mjs so raw PGP is served on pgp.* / gpg.* before
 * Astro's handler serves prerendered index.html from ASSETS (middleware never runs there).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = 'PGP_SUBDOMAIN_ENTRY_WRAPPED';

export default function pgpSubdomainWorkerEntry() {
  return {
    name: 'pgp-subdomain-worker-entry',
    hooks: {
      'astro:build:done': ({ dir }) => {
        // `dir` is the client output dir (e.g. dist/client); server bundle is sibling server/entry.mjs
        const entryUrl = new URL('../server/entry.mjs', dir);
        const entryPath = fileURLToPath(entryUrl);
        let src = readFileSync(entryPath, 'utf8');
        if (src.includes(MARKER)) {
          return;
        }
        const m = src.match(/from\s+"(\.\/chunks\/worker-entry_[^"]+\.mjs)"/);
        if (!m) {
          throw new Error(
            'pgp-subdomain-worker-entry: expected import from ./chunks/worker-entry_*.mjs in server/entry.mjs'
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
