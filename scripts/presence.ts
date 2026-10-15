// Reports lid state and agent session counts to the site's POST /presence, signed
// with my OpenPGP key. Run every 30 seconds by launchd (scripts/me.v0id.presence.plist).
// Sends when something changed (at most once per MIN_GAP_MS), and every 5 minutes as a
// heartbeat so the site can tell "asleep" from "nothing changed". Free KV allows 1,000
// writes a day: up to 650 change sends plus at most 288 heartbeats stays under it.
//
//   bun run scripts/presence.ts           report once
//   bun run scripts/presence.ts --print   show what would be signed, send nothing
//
// PRESENCE_URL defaults to production. Signing goes through gpg-agent. After a reboot
// the agent is empty and asks pinentry-mac, which reads the passphrase from the login
// keychain without showing anything. If it is not in the keychain, pinentry-mac shows
// a dialog; after SIGN_TIMEOUT_MS the run gives up and nothing is sent.
//
// A run that never ends blocks every later one, because launchd does not start the job
// again while it is still running. A request hung across sleep once stopped all reports
// for a day, so the request has a timeout and the whole run a hard deadline.

import { $ } from "bun";
import { homedir } from "node:os";
import { join } from "node:path";

const URL = process.env.PRESENCE_URL ?? "https://www.v0id.me/presence";
const KEY = "6BEC93C909633B56534E2DCE1F4F0EDA64619E19";
const PURPOSE = "v0id.me/presence";
const HEARTBEAT_MS = 5 * 60_000;
const MIN_GAP_MS = 40_000;
const DAILY_BUDGET = 650;
const SIGN_TIMEOUT_MS = 20_000;
const REQUEST_TIMEOUT_MS = 15_000;
const RUN_DEADLINE_MS = 50_000;
const STATE_FILE = join(homedir(), "Library/Caches/peace-land-presence.json");
// No key or mouse input for this long means I stepped away, even with the Mac awake.
const AWAY_IDLE_S = 10 * 60;

setTimeout(() => {
  console.error(`presence: run passed ${RUN_DEADLINE_MS / 1000}s, giving up`);
  process.exit(1);
}, RUN_DEADLINE_MS).unref();

async function lid(): Promise<"open" | "closed"> {
  const out = await $`ioreg -r -k AppleClamshellState -d 4`.text();
  return /"AppleClamshellState" = Yes/.test(out) ? "closed" : "open";
}

// Claude Code lists every live session on this Mac, desktop, terminal and background,
// with its own busy or idle status: busy for the whole turn, including while the model
// streams or a long command runs. Sessions working in a hidden folder of my home
// (~/.claude-mem and the like) are plugin helpers, not my agents.
// Cloud sessions are not counted: nothing on the Mac reports their status.
async function agents(): Promise<{ agents: number; busy: number }> {
  const sessions: { cwd: string; status: string }[] = JSON.parse(await $`claude agents --json`.text());
  const mine = sessions.filter((s) => !s.cwd.startsWith(`${homedir()}/.`));
  return { agents: mine.length, busy: mine.filter((s) => s.status === "busy").length };
}

// Whether I am at the Mac, as opposed to the Mac merely being awake. Apps such as
// caffeinate or the Claude app keep it awake with the lid closed, so being able to
// report at all says nothing about me.
async function here(lid: "open" | "closed"): Promise<boolean> {
  if (/"IOConsoleLocked" = Yes/.test(await $`ioreg -n Root -d1`.text())) return false;
  const idle = (await $`ioreg -c IOHIDSystem`.text()).match(/"HIDIdleTime" = (\d+)/);
  if (idle && Number(idle[1]) / 1e9 >= AWAY_IDLE_S) return false;
  if (lid === "closed") {
    // Lid closed with a monitor attached is the Mac used docked; without one it is in a bag.
    const displays = JSON.parse(await $`system_profiler SPDisplaysDataType -json`.text());
    const external = (displays.SPDisplaysDataType ?? [])
      .flatMap((gpu: any) => gpu.spdisplays_ndrvs ?? [])
      .filter((d: any) => d.spdisplays_connection_type !== "spdisplays_internal");
    if (external.length === 0) return false;
  }
  return true;
}

const lidState = await lid();
const state = { lid: lidState, here: await here(lidState), ...(await agents()) };
const stateJson = JSON.stringify(state);
const payload = JSON.stringify({ for: PURPOSE, ts: Math.floor(Date.now() / 1000), ...state });

if (process.argv.includes("--print")) {
  console.log(payload);
  process.exit(0);
}

const last = await Bun.file(STATE_FILE).json().catch(() => null);
const sinceLast = Date.now() - (last?.sentAt ?? 0);
const today = new Date().toDateString();
const sentToday = last?.day === today ? last.sentToday : 0;
const changed = last?.state !== stateJson;
const heartbeatDue = sinceLast >= HEARTBEAT_MS;
const changeAllowed = changed && sinceLast >= MIN_GAP_MS && sentToday < DAILY_BUDGET;
if (!heartbeatDue && !changeAllowed) process.exit(0);

const gpg = Bun.spawn(
  ["gpg", "--batch", "--local-user", KEY, "--detach-sign"],
  { stdin: new TextEncoder().encode(payload), stdout: "pipe", stderr: "pipe" },
);
const timer = setTimeout(() => gpg.kill(), SIGN_TIMEOUT_MS);
const signature = Buffer.from(await new Response(gpg.stdout).arrayBuffer());
const code = await gpg.exited;
clearTimeout(timer);
if (code !== 0 || signature.length === 0) {
  console.error(`presence: gpg could not sign (exit ${code}): ${(await new Response(gpg.stderr).text()).trim()}`);
  process.exit(1);
}

const res = await fetch(URL, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Signature": signature.toString("base64") },
  body: payload,
  signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
});
if (!res.ok) {
  console.error(`presence: ${URL} answered ${res.status}`);
  process.exit(1);
}
await Bun.write(STATE_FILE, JSON.stringify({ state: stateJson, sentAt: Date.now(), day: today, sentToday: sentToday + 1 }));
