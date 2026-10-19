// The visit count next to rss on the home page. The Worker entry
// (src/integrations/pgp-subdomain-worker-entry.js) counts page loads into KV.
export const VISITS_KEY = 'visits';

export async function getVisits(kv: KVNamespace | undefined): Promise<number | null> {
  try {
    const n = Number(await kv?.get(VISITS_KEY, { cacheTtl: 30 }));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
