// Guestbook entries live in the SESSION KV namespace, one key per entry, with the entry
// itself in the key's metadata so one list call returns them all. New entries wait under
// gb:pending: until I approve them with scripts/guestbook.ts, then move to gb:ok:.
// Keys sort newest first because the id starts with a countdown from the far future.

export interface Entry {
  id: string;
  name: string;
  site?: string;
  msg: string;
  at: number;
}

export const PENDING = 'gb:pending:';
export const APPROVED = 'gb:ok:';
const RATE = 'gb:rate:';
// KV metadata holds at most 1024 bytes; these limits keep an entry well under it even
// when every character takes two bytes.
const MAX_NAME = 40;
const MAX_SITE = 100;
const MAX_MSG = 280;
// Enough to wait for me, small enough that a flood stops quickly.
const MAX_PENDING = 100;

export function newId(now = Date.now()): string {
  return `${String(9_999_999_999_999 - now).padStart(13, '0')}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function listEntries(kv: KVNamespace, prefix: string, limit = 200): Promise<Entry[]> {
  const { keys } = await kv.list<Omit<Entry, 'id'>>({ prefix, limit });
  return keys.flatMap((k) => (k.metadata ? [{ id: k.name.slice(prefix.length), ...k.metadata }] : []));
}

const clean = (v: FormDataEntryValue | null) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim() : '';

export type SignResult =
  | { ok: true; name: string }
  | { ok: false; status: number; reason: string };

// Validates a submission and stores it as pending. `ip` only feeds a one-minute rate
// limit and is stored hashed, for that minute.
export async function sign(kv: KVNamespace, form: FormData, ip: string): Promise<SignResult> {
  const name = clean(form.get('name'));
  const msg = clean(form.get('msg'));
  const site = clean(form.get('site'));
  // A field people never see. Bots fill it; they get a thank-you and nothing is stored.
  if (clean(form.get('email'))) return { ok: true, name: name || 'friend' };

  if (!name || name.length > MAX_NAME) return { ok: false, status: 400, reason: `name is required, up to ${MAX_NAME} characters` };
  if (!msg || msg.length > MAX_MSG) return { ok: false, status: 400, reason: `message is required, up to ${MAX_MSG} characters` };
  if (site) {
    let url: URL | null = null;
    try {
      url = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`);
    } catch {}
    if (!url || site.length > MAX_SITE || !/^https?:$/.test(url.protocol)) {
      return { ok: false, status: 400, reason: 'site must be a web address' };
    }
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`guestbook:${ip}`));
  const rateKey = RATE + [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (await kv.get(rateKey)) return { ok: false, status: 429, reason: 'one message a minute, try again shortly' };
  const { keys } = await kv.list({ prefix: PENDING, limit: MAX_PENDING });
  if (keys.length >= MAX_PENDING) return { ok: false, status: 503, reason: 'the guestbook is full for now, try again later' };

  const entry: Omit<Entry, 'id'> = { name, msg, at: Date.now(), ...(site ? { site } : {}) };
  await Promise.all([
    kv.put(PENDING + newId(entry.at), '', { metadata: entry }),
    kv.put(rateKey, '1', { expirationTtl: 60 }),
  ]);
  return { ok: true, name };
}

export const siteHref = (site: string) => (/^https?:\/\//i.test(site) ? site : `https://${site}`);
export const siteLabel = (site: string) => site.replace(/^https?:\/\//i, '').replace(/\/$/, '');

// The terminal view: date, name, message, one entry per line.
export function entriesText(entries: Entry[]): string {
  if (entries.length === 0) return 'no entries yet. sign it: curl -d name=you -d msg=hello https://www.v0id.me/guestbook\n';
  const width = Math.min(16, Math.max(...entries.map((e) => e.name.length)));
  return entries
    .map((e) => `${new Date(e.at).toISOString().slice(0, 10)}  ${e.name.padEnd(width)}  ${e.msg}`)
    .join('\n') + '\n';
}
