// The status block's wording, shared by the /now-playing iframe and the plain-text
// routes, so a terminal reads exactly what the sidebar shows.

import type { LatestCommit } from "./github";
import type { PresenceView } from "./presence";

export function ago(ms: number): string {
  const min = Math.floor((Date.now() - ms) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  if (min < 48 * 60) return `${Math.floor(min / 60)}h ago`;
  return `${Math.floor(min / 1440)}d ago`;
}

export type StatusWord = "active" | "away" | "inactive";

export function statusWord(presence: PresenceView | null): StatusWord | null {
  if (!presence) return null;
  if (presence.state === "asleep") return "inactive";
  return presence.here ? "active" : "away";
}

// Awake but not here means the Mac runs without me: open and left alone, or closed and
// kept awake by something like caffeinate. Closed while here is the Mac used docked.
export function laptopText(presence: PresenceView | null): string | null {
  if (!presence) return null;
  if (presence.state === "asleep") return `zzz since ${ago(presence.at).replace(" ago", "")}`;
  if (presence.here) return presence.lid;
  return presence.lid === "open" ? "open, unattended" : "closed, kept awake";
}

export function sessionsText(presence: PresenceView | null): { count: string; split: string } | null {
  if (presence?.state !== "awake" || presence.agents === 0) return null;
  const { agents, busy } = presence;
  return {
    count: `${agents} ${agents === 1 ? "session" : "sessions"}`,
    split: busy === 0 ? `${agents} idle`
      : busy === agents ? `${busy} working`
      : `${busy} working, ${agents - busy} idle`,
  };
}

// The same rows as the iframe, in the same columns: values start at the tenth character.
export function statusText(presence: PresenceView | null, commit: LatestCommit | null): string {
  const row = (key: string, value: string) => `  ${key.padEnd(7)}${value}`;
  const lines: string[] = [];
  const word = statusWord(presence);
  lines.push(word ? `fahad ${word}` : "fahad");
  const laptop = laptopText(presence);
  if (laptop) lines.push(row("laptop", laptop));
  if (presence) {
    const sessions = sessionsText(presence);
    if (sessions) lines.push(row("claude", sessions.count), row("", sessions.split));
    else lines.push(row("claude", "no sessions"));
  }
  if (commit) lines.push(row("git", ago(commit.date.getTime())));
  return lines.join("\n") + "\n";
}
