// Reports lid state and agent session counts to the site's POST /presence, signed
// with my OpenPGP key. Run every 2 minutes by launchd (scripts/me.v0id.presence.plist).
// Sends only when something changed, or every 6 minutes as a heartbeat so the site can
// tell "asleep" from "nothing changed". That keeps KV writes under ~720 a day.
//
//   bun run scripts/presence.ts           report once
//   bun run scripts/presence.ts --print   show what would be signed, send nothing
//
// PRESENCE_URL defaults to production. Signing goes through gpg-agent. After a reboot
// the agent is empty and asks pinentry-mac, which reads the passphrase from the login
// keychain without showing anything. If it is not in the keychain, pinentry-mac shows
// a dialog; after SIGN_TIMEOUT_MS the run gives up and nothing is sent.

import { $ } from "bun";
import { homedir } from "node:os";
import { join } from "node:path";

const URL = process.env.PRESENCE_URL ?? "https://www.v0id.me/presence";
const KEY = "6BEC93C909633B56534E2DCE1F4F0EDA64619E19";
const PURPOSE = "v0id.me/presence";
const HEARTBEAT_MS = 6 * 60_000;
const SIGN_TIMEOUT_MS = 60_000;
// ps %cpu is a decaying average; an idle session sits under 1%, a working one well above.
const BUSY_CPU = 2;
const STATE_FILE = join(homedir(), "Library/Caches/peace-land-presence.json");

async function lid(): Promise<"open" | "closed"> {
  const out = await $`ioreg -r -k AppleClamshellState -d 4`.text();
  return /"AppleClamshellState" = Yes/.test(out) ? "closed" : "open";
}

// A session is a process whose executable is named claude and that is either a
// Claude desktop session (lives under .../claude-code/) or a terminal session (has
// a tty). That leaves out SDK-spawned helpers and the Chrome native host.
async function agents(): Promise<{ agents: number; busy: number }> {
  const out = await $`ps -axo pcpu=,tty=,comm=`.text();
  let agents = 0;
  let busy = 0;
  for (const line of out.split("\n")) {
    const m = line.match(/^\s*([\d.]+)\s+(\S+)\s+(.+)$/);
    if (!m) continue;
    const [, cpu, tty, comm] = m;
    if (!/(^|\/)claude$/.test(comm)) continue;
    if (!comm.includes("/claude-code/") && tty === "??") continue;
    agents++;
    if (Number(cpu) >= BUSY_CPU) busy++;
  }
  return { agents, busy };
}

const state = { lid: await lid(), ...(await agents()) };
const stateJson = JSON.stringify(state);
const payload = JSON.stringify({ for: PURPOSE, ts: Math.floor(Date.now() / 1000), ...state });

if (process.argv.includes("--print")) {
  console.log(payload);
  process.exit(0);
}

const last = await Bun.file(STATE_FILE).json().catch(() => null);
if (last?.state === stateJson && Date.now() - last.sentAt < HEARTBEAT_MS) process.exit(0);

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
});
if (!res.ok) {
  console.error(`presence: ${URL} answered ${res.status}`);
  process.exit(1);
}
await Bun.write(STATE_FILE, JSON.stringify({ state: stateJson, sentAt: Date.now() }));
