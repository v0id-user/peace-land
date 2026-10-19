// Moderates the guestbook at v0id.me/guestbook. Every request is signed with my key,
// the same way scripts/presence.ts signs status reports.
//
//   bun run scripts/guestbook.ts                 list entries waiting for approval
//   bun run scripts/guestbook.ts approve <id>    publish one
//   bun run scripts/guestbook.ts reject <id>     delete one that is waiting
//   bun run scripts/guestbook.ts remove <id>     take down a published one
//   bun run scripts/guestbook.ts published       list published entries
//
// GUESTBOOK_URL defaults to production.

const URL = process.env.GUESTBOOK_URL ?? "https://www.v0id.me/guestbook/admin";
const KEY = "6BEC93C909633B56534E2DCE1F4F0EDA64619E19";

interface Entry { id: string; name: string; site?: string; msg: string; at: number }

async function call(action: string, id?: string): Promise<any> {
  const payload = JSON.stringify({ for: "v0id.me/guestbook", ts: Date.now(), action, ...(id ? { id } : {}) });
  const gpg = Bun.spawn(["gpg", "--batch", "--local-user", KEY, "--detach-sign"], {
    stdin: new TextEncoder().encode(payload),
    stdout: "pipe",
  });
  const signature = Buffer.from(await new Response(gpg.stdout).arrayBuffer()).toString("base64");
  if ((await gpg.exited) !== 0) throw new Error("gpg could not sign");
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Signature": signature },
    body: payload,
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) throw new Error(`no entry ${id}`);
  if (!res.ok) throw new Error(`${URL} answered ${res.status}`);
  return res.json();
}

function show(entries: Entry[], empty: string) {
  if (entries.length === 0) return console.log(empty);
  for (const e of entries) {
    console.log(`${e.id}  ${new Date(e.at).toISOString().slice(0, 16).replace("T", " ")}  ${e.name}${e.site ? ` (${e.site})` : ""}`);
    console.log(`    ${e.msg}\n`);
  }
}

const [action = "list", id] = process.argv.slice(2);
if (action === "list" || action === "published") {
  const { pending, approved } = await call("list");
  if (action === "list") show(pending, "nothing waiting");
  else show(approved, "nothing published");
} else if (["approve", "reject", "remove"].includes(action) && id) {
  await call(action, id);
  console.log(`${action === "approve" ? "approved" : action === "reject" ? "rejected" : "removed"} ${id}`);
} else {
  console.error("usage: bun run scripts/guestbook.ts [list|published|approve <id>|reject <id>|remove <id>]");
  process.exit(1);
}
