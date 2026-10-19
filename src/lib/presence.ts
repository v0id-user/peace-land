// The laptop reports itself to POST /presence and the sidebar reads it back from KV.
// Only coarse state is stored: lid position and how many agent sessions are open and
// how many of those are working. Never hostnames, paths, repos, or what an agent does.

export const PRESENCE_KEY = "presence";
// Signed into every report so a signature made for anything else is never accepted here.
export const PRESENCE_PURPOSE = "v0id.me/presence";
const MAX_AGENTS = 32;

// scripts/presence.ts reports changes as they happen, says so itself just before the
// Mac sleeps, and sends a heartbeat every 15 minutes. Silence past 20 minutes covers
// what it cannot announce (a crash, a dead battery) and also reads as asleep.
const STALE_MS = 20 * 60_000;

export interface PresenceReport {
  lid: "open" | "closed";
  // At the Mac (unlocked, recent input, lid open or a monitor attached) rather than
  // the Mac just being awake. Decided on the laptop by scripts/presence.ts.
  here: boolean;
  agents: number;
  busy: number;
  // Sent once, just before the Mac sleeps. Optional so older reporters still validate.
  asleep: boolean;
}

export interface SignedReport extends PresenceReport {
  // Unix seconds from the laptop's clock, covered by the signature.
  ts: number;
}

export interface Presence extends PresenceReport {
  at: number;
  ts: number;
  // The report exactly as the laptop signed it, and its detached signature (base64), so
  // /status.asc can hand anyone the signed original to check with gpg. Absent on
  // records written before they were kept.
  body?: string;
  sig?: string;
}

export type PresenceView =
  | ({ state: "awake" } & Presence)
  | { state: "asleep"; at: number };

// Accepts exactly the known fields and nothing else, so a bug on the laptop side
// cannot push anything richer onto the public page.
export function parseReport(body: unknown): SignedReport | null {
  if (!body || typeof body !== "object") return null;
  const { for: purpose, ts, lid, here, agents, busy, asleep = false, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length > 0) return null;
  if (purpose !== PRESENCE_PURPOSE) return null;
  if (lid !== "open" && lid !== "closed") return null;
  if (typeof here !== "boolean" || typeof asleep !== "boolean") return null;
  if (!Number.isInteger(ts) || !Number.isInteger(agents) || !Number.isInteger(busy)) return null;
  const a = agents as number;
  const b = busy as number;
  if (a < 0 || a > MAX_AGENTS || b < 0 || b > a) return null;
  return { lid, here, agents: a, busy: b, asleep, ts: ts as number };
}

export async function getPresence(kv: KVNamespace | undefined): Promise<PresenceView | null> {
  if (!kv) return null;
  try {
    // KV serves a value cached at the edge for up to 60 seconds by default; 30 is the floor.
    const p = await kv.get<Presence>(PRESENCE_KEY, { type: "json", cacheTtl: 30 });
    if (!p) return null;
    if (p.asleep || Date.now() - p.at > STALE_MS) return { state: "asleep", at: p.at };
    return { state: "awake", ...p };
  } catch (err) {
    console.error("presence read threw", err);
    return null;
  }
}
