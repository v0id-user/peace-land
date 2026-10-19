import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { PRESENCE_KEY, parseReport, type Presence } from '../lib/presence';
import { signedByMe } from '../lib/signed';

export const prerender = false;

// A report is about 80 bytes; anything near this is not from the laptop.
const MAX_BODY = 1024;
// How far the laptop's clock may be from the Worker's.
const MAX_SKEW_MS = 2 * 60_000;

export const POST: APIRoute = async ({ request }) => {
  const kv = (env as any).SESSION as KVNamespace | undefined;
  if (!kv) return new Response(null, { status: 404 });

  // 403, not 401: the dev server proxies through undici, which turns a 401 to a
  // request with a streamed body into a network error.
  const signature = request.headers.get('X-Signature');
  if (!signature) return new Response(null, { status: 403 });
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY) {
    return new Response(null, { status: 413 });
  }

  // Verify the exact bytes that were signed, then parse them.
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.length > MAX_BODY) return new Response(null, { status: 413 });
  if (!(await signedByMe(body, signature))) return new Response(null, { status: 403 });

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch {}
  const report = parseReport(parsed);
  if (!report) return new Response(null, { status: 400 });

  // A captured request stops working after two minutes, and can never be sent twice
  // because each accepted ts must be newer than the last.
  const now = Date.now();
  if (Math.abs(now - report.ts * 1000) > MAX_SKEW_MS) return new Response(null, { status: 403 });
  const last = await kv.get<Presence>(PRESENCE_KEY, 'json');
  if (last && report.ts <= last.ts) return new Response(null, { status: 403 });

  const presence: Presence = {
    lid: report.lid,
    here: report.here,
    agents: report.agents,
    busy: report.busy,
    asleep: report.asleep,
    ts: report.ts,
    at: now,
    body: new TextDecoder().decode(body),
    sig: signature,
  };
  await kv.put(PRESENCE_KEY, JSON.stringify(presence));
  return new Response(null, { status: 204 });
};
