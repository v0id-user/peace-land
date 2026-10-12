// The laptop reports itself to POST /presence and the sidebar reads it back from KV.
// Only coarse state is stored: lid position and how many agent sessions are open and
// how many of those are working. Never hostnames, paths, repos, or what an agent does.

export const PRESENCE_KEY = "presence";
// Signed into every report so a signature made for anything else is never accepted here.
export const PRESENCE_PURPOSE = "v0id.me/presence";
const MAX_AGENTS = 32;

// scripts/presence.ts runs every 2 minutes and writes on change or every 6 minutes.
// A report older than 9 minutes means the laptop stopped reporting: it is asleep.
const STALE_MS = 9 * 60_000;

export interface PresenceReport {
  lid: "open" | "closed";
  agents: number;
  busy: number;
}

export interface SignedReport extends PresenceReport {
  // Unix seconds from the laptop's clock, covered by the signature.
  ts: number;
}

export interface Presence extends PresenceReport {
  at: number;
  ts: number;
}

export type PresenceView =
  | ({ state: "awake" } & Presence)
  | { state: "asleep"; at: number };

// Accepts exactly the known fields and nothing else, so a bug on the laptop side
// cannot push anything richer onto the public page.
export function parseReport(body: unknown): SignedReport | null {
  if (!body || typeof body !== "object") return null;
  const { for: purpose, ts, lid, agents, busy, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length > 0) return null;
  if (purpose !== PRESENCE_PURPOSE) return null;
  if (lid !== "open" && lid !== "closed") return null;
  if (!Number.isInteger(ts) || !Number.isInteger(agents) || !Number.isInteger(busy)) return null;
  const a = agents as number;
  const b = busy as number;
  if (a < 0 || a > MAX_AGENTS || b < 0 || b > a) return null;
  return { lid, agents: a, busy: b, ts: ts as number };
}

export async function getPresence(kv: KVNamespace | undefined): Promise<PresenceView | null> {
  if (!kv) return null;
  try {
    const p = await kv.get<Presence>(PRESENCE_KEY, "json");
    if (!p) return null;
    if (Date.now() - p.at > STALE_MS) return { state: "asleep", at: p.at };
    return { state: "awake", ...p };
  } catch (err) {
    console.error("presence read threw", err);
    return null;
  }
}
