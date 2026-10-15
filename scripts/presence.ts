// Reports lid state, whether I am at the Mac, and agent session counts to the site's
// POST /presence, signed with my OpenPGP key. Kept running by launchd
// (scripts/me.v0id.presence.plist).
//
// Everything is compared on the Mac and only a change leaves it. Every CHECK_MS the
// state is read again; it is sent when it differs from the last one sent, and otherwise
// only as a HEARTBEAT_MS heartbeat. scripts/presence-events.swift adds macOS events:
// lock, unlock and wake trigger a check at once, and before the Mac sleeps the reporter
// sends "asleep" while macOS waits for it. The site therefore shows sleep within
// seconds and only falls back to silence (20 minutes) when the Mac could not say so.
//
//   bun run scripts/presence.ts           run until stopped
//   bun run scripts/presence.ts --print   show the current state, send nothing
//
// PRESENCE_URL defaults to production. Signing goes through gpg-agent; after a reboot
// pinentry-mac reads the passphrase from the login keychain without showing anything.
//
// A reporter that stops making progress would leave the site wrong for as long as it
// lives, as a request hung across sleep once did for a day. Every external call has a
// timeout, and a watchdog exits when no check has finished for STUCK_MS, so launchd
// starts a fresh one.

import { homedir } from "node:os";
import { join } from "node:path";

const URL = process.env.PRESENCE_URL ?? "https://www.v0id.me/presence";
const EVENTS_BIN = process.env.PRESENCE_EVENTS ?? join(homedir(), ".local/bin/v0id-presence-events");
const KEY = "6BEC93C909633B56534E2DCE1F4F0EDA64619E19";
const PURPOSE = "v0id.me/presence";
const CHECK_MS = 10_000;
const HEARTBEAT_MS = 15 * 60_000;
const CHECK_TIMEOUT_MS = 20_000;
const SIGN_TIMEOUT_MS = 20_000;
const REQUEST_TIMEOUT_MS = 15_000;
// Before sleep, macOS waits at most 10 seconds for the helper's ack.
const SLEEP_REPORT_TIMEOUT_MS = 6_000;
const STUCK_MS = 90_000;
const STATE_FILE = process.env.PRESENCE_STATE_FILE ?? join(homedir(), "Library/Caches/peace-land-presence.json");
// No key or mouse input for this long means I stepped away, even with the Mac awake.
const AWAY_IDLE_S = 10 * 60;

type Lid = "open" | "closed";
interface State {
  lid: Lid;
  here: boolean;
  agents: number;
  busy: number;
}

// Runs a command and kills it if it outlives `ms`, so a hung tool never piles up.
async function run(cmd: string[], ms = 8_000): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "ignore" });
  const timer = setTimeout(() => proc.kill(), ms);
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  clearTimeout(timer);
  if (code !== 0) throw new Error(`${cmd.join(" ")} failed or took over ${ms / 1000}s`);
  return out;
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} took over ${ms / 1000}s`)), ms)),
  ]);
}

async function lid(): Promise<Lid> {
  const out = await run(["ioreg", "-r", "-k", "AppleClamshellState", "-d", "4"]);
  return /"AppleClamshellState" = Yes/.test(out) ? "closed" : "open";
}

// Claude Code lists every live session on this Mac, desktop, terminal and background,
// with its own busy or idle status: busy for the whole turn, including while the model
// streams or a long command runs. Sessions working in a hidden folder of my home
// (~/.claude-mem and the like) are plugin helpers, not my agents.
// Cloud sessions are not counted: nothing on the Mac reports their status.
async function agents(): Promise<{ agents: number; busy: number }> {
  const sessions: { cwd: string; status: string }[] = JSON.parse(await run(["claude", "agents", "--json"]));
  const mine = sessions.filter((s) => !s.cwd.startsWith(`${homedir()}/.`));
  return { agents: mine.length, busy: mine.filter((s) => s.status === "busy").length };
}

// Whether I am at the Mac, as opposed to the Mac merely being awake. Apps such as
// caffeinate or the Claude app keep it awake with the lid closed, so being able to
// report at all says nothing about me.
async function here(lid: Lid): Promise<boolean> {
  if (/"IOConsoleLocked" = Yes/.test(await run(["ioreg", "-n", "Root", "-d1"]))) return false;
  const idle = (await run(["ioreg", "-c", "IOHIDSystem"])).match(/"HIDIdleTime" = (\d+)/);
  if (idle && Number(idle[1]) / 1e9 >= AWAY_IDLE_S) return false;
  if (lid === "closed") {
    // Lid closed with a monitor attached is the Mac used docked; without one it is in a bag.
    const displays = JSON.parse(await run(["system_profiler", "SPDisplaysDataType", "-json"]));
    const external = (displays.SPDisplaysDataType ?? [])
      .flatMap((gpu: any) => gpu.spdisplays_ndrvs ?? [])
      .filter((d: any) => d.spdisplays_connection_type !== "spdisplays_internal");
    if (external.length === 0) return false;
  }
  return true;
}

async function readState(): Promise<State> {
  const l = await lid();
  return { lid: l, here: await here(l), ...(await agents()) };
}

if (process.argv.includes("--print")) {
  console.log(JSON.stringify(await readState()));
  process.exit(0);
}

// What was last accepted by the site, kept across restarts so a restart does not resend.
let last: { state: string; sentAt: number; ts: number } = await Bun.file(STATE_FILE)
  .json()
  .then((l) => ({ state: l.state ?? "", sentAt: l.sentAt ?? 0, ts: l.ts ?? 0 }))
  .catch(() => ({ state: "", sentAt: 0, ts: 0 }));

async function sign(payload: string): Promise<string> {
  const gpg = Bun.spawn(["gpg", "--batch", "--local-user", KEY, "--detach-sign"], {
    stdin: new TextEncoder().encode(payload),
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(() => gpg.kill(), SIGN_TIMEOUT_MS);
  const signature = Buffer.from(await new Response(gpg.stdout).arrayBuffer());
  const code = await gpg.exited;
  clearTimeout(timer);
  if (code !== 0 || signature.length === 0) {
    throw new Error(`gpg could not sign (exit ${code}): ${(await new Response(gpg.stderr).text()).trim()}`);
  }
  return signature.toString("base64");
}

// The site accepts only a ts newer than the last one, so two reports in the same second
// (a change, then sleep) take consecutive seconds.
async function send(state: State, asleep: boolean, timeoutMs: number): Promise<void> {
  const ts = Math.max(Math.floor(Date.now() / 1000), last.ts + 1);
  const payload = JSON.stringify({ for: PURPOSE, ts, ...state, asleep });
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Signature": await sign(payload) },
    body: payload,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${URL} answered ${res.status}`);
  // After an asleep report the next check must send even if nothing else changed.
  last = { state: asleep ? "" : JSON.stringify(state), sentAt: Date.now(), ts };
  await Bun.write(STATE_FILE, JSON.stringify(last));
}

// One thing at a time: a check and a sleep report never sign or send concurrently.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
}

let lastCheckDone = Date.now();
let lastState: State | null = null;

function check(): Promise<void> {
  return serial(async () => {
    try {
      const state = await withTimeout(readState(), CHECK_TIMEOUT_MS, "reading state");
      lastState = state;
      if (JSON.stringify(state) !== last.state || Date.now() - last.sentAt >= HEARTBEAT_MS) {
        await send(state, false, REQUEST_TIMEOUT_MS);
      }
    } catch (err) {
      console.error(`presence: ${(err as Error).message}`);
    } finally {
      lastCheckDone = Date.now();
    }
  });
}

function reportSleep(): Promise<void> {
  return serial(async () => {
    try {
      const state = lastState ?? { lid: "open" as Lid, here: false, agents: 0, busy: 0 };
      await send({ ...state, here: false }, true, SLEEP_REPORT_TIMEOUT_MS);
    } catch (err) {
      console.error(`presence: sleep report failed: ${(err as Error).message}`);
    }
  });
}

// Events are optional: without the helper the reporter still works, only sleep shows
// later (through silence).
async function listen(): Promise<void> {
  if (!(await Bun.file(EVENTS_BIN).exists())) {
    console.error(`presence: ${EVENTS_BIN} missing, running without macOS events`);
    return;
  }
  const helper = Bun.spawn([EVENTS_BIN], { stdin: "pipe", stdout: "pipe", stderr: "inherit" });
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of helper.stdout) {
    buffer += decoder.decode(chunk);
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const event = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (event === "will-sleep") {
        await reportSleep();
        helper.stdin.write("ack\n");
        helper.stdin.flush();
      } else if (event === "wake" || event === "lock" || event === "unlock") {
        check();
      }
    }
  }
  // The helper should live as long as the reporter. If it dies, launchd restarts both.
  console.error("presence: event helper exited");
  process.exit(1);
}

// Timers stop while the Mac sleeps. A watchdog tick far later than scheduled means the
// Mac just woke, not that a check is stuck, so the clock starts over.
let lastWatchdogTick = Date.now();
setInterval(() => {
  const now = Date.now();
  if (now - lastWatchdogTick > 45_000) lastCheckDone = now;
  lastWatchdogTick = now;
  if (now - lastCheckDone > STUCK_MS) {
    console.error(`presence: no check finished for ${STUCK_MS / 1000}s, exiting`);
    process.exit(1);
  }
}, 15_000);

listen();
check();
setInterval(check, CHECK_MS);
