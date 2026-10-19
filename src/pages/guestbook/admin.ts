import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { APPROVED, PENDING, listEntries, type Entry } from '../../lib/guestbook';
import { signedByMe } from '../../lib/signed';

export const prerender = false;

// scripts/guestbook.ts lists, approves and removes entries through here. Like
// /presence, every request is signed with my key, at most 2 minutes old, and newer
// than the last one, so a captured request cannot be replayed.
const PURPOSE = 'v0id.me/guestbook';
const MAX_SKEW_MS = 2 * 60_000;
const LAST_TS = 'gb:admin-ts';
const ACTIONS = new Set(['list', 'approve', 'reject', 'remove']);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const kv = (env as any).SESSION as KVNamespace | undefined;
  const signature = request.headers.get('X-Signature');
  if (!kv || !signature) return new Response(null, { status: 403 });
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.length > 512 || !(await signedByMe(body, signature))) return new Response(null, { status: 403 });

  let parsed: any = null;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch {}
  const { for: purpose, ts, action, id, ...rest } = parsed ?? {};
  if (purpose !== PURPOSE || !Number.isInteger(ts) || !ACTIONS.has(action) || Object.keys(rest).length > 0) {
    return new Response(null, { status: 400 });
  }
  if (action !== 'list' && (typeof id !== 'string' || !/^[0-9]{13}-[0-9a-f]{8}$/.test(id))) {
    return new Response(null, { status: 400 });
  }
  const now = Date.now();
  if (Math.abs(now - ts) > MAX_SKEW_MS) return new Response(null, { status: 403 });
  if (ts <= Number(await kv.get(LAST_TS))) return new Response(null, { status: 403 });
  await kv.put(LAST_TS, String(ts));

  if (action === 'list') {
    const [pending, approved] = await Promise.all([listEntries(kv, PENDING), listEntries(kv, APPROVED)]);
    return json({ pending, approved });
  }
  const from = action === 'remove' ? APPROVED : PENDING;
  const found = await kv.getWithMetadata<Omit<Entry, 'id'>>(from + id);
  if (!found.metadata) return new Response(null, { status: 404 });
  if (action === 'approve') await kv.put(APPROVED + id, '', { metadata: found.metadata });
  await kv.delete(from + id);
  return json({ ok: true });
};
