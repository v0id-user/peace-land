const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";
const LOGIN = "v0id-user";
// My GraphQL node id, for history's author filter (it takes an id, not a login).
const USER_ID = "U_kgDOCkgAoQ";
const CACHE_TTL_MS = 5 * 60_000;

export interface LatestCommit {
  headline: string;
  repo: string;
  url: string;
  date: Date;
}

// Every repo I committed to in the last year, mine or an organization's. GITHUB_TOKEN
// can read private repos, work ones included, so this list contains them too. It asks
// for names and privacy only; private repos are dropped before anything else is fetched.
// GITHUB_SKIP_OWNERS (comma-separated, set as a secret, not in this repo) drops whole
// accounts as well, so commits there never show even if one of their repos goes public.
const REPOS_QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      commitContributionsByRepository(maxRepositories: 50) {
        repository { nameWithOwner isPrivate }
      }
    }
  }
}`;

// My newest commit on the default branch of each public repo, one alias per repo.
function commitsQuery(repos: string[]): string {
  const fields = repos.map((nameWithOwner, i) => {
    const [owner, name] = nameWithOwner.split("/");
    return `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {
      nameWithOwner isPrivate
      defaultBranchRef { target { ... on Commit {
        history(first: 1, author: { id: "${USER_ID}" }) { nodes { messageHeadline committedDate url } }
      } } }
    }`;
  });
  return `query { ${fields.join("\n")} }`;
}

async function graphql(token: string, query: string, variables?: object): Promise<any> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "peace-land",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json: any = await res.json();
  if (!res.ok || json.errors?.length) {
    throw new Error(`GitHub API ${res.status}: ${json.errors?.[0]?.message ?? "no message"}`);
  }
  return json.data;
}

// The newest of my commits on public repos. Takes about 5 seconds (two GraphQL calls),
// so it never runs while a reader waits.
async function fetchNewest(env: any): Promise<LatestCommit | null> {
  const token = env.GITHUB_TOKEN;
  const skip = new Set(
    String(env.GITHUB_SKIP_OWNERS ?? "").split(",").map((o) => o.trim().toLowerCase()).filter(Boolean),
  );
  const contributed = await graphql(token, REPOS_QUERY, { login: LOGIN });
  const publicRepos: string[] = (contributed.user?.contributionsCollection?.commitContributionsByRepository ?? [])
    .map((c: any) => c.repository)
    .filter((r: any) => r && r.isPrivate === false)
    .map((r: any) => r.nameWithOwner as string)
    .filter((name) => !skip.has(name.split("/")[0].toLowerCase()));
  if (publicRepos.length === 0) return null;

  let newest: LatestCommit | null = null;
  const repos = Object.values(await graphql(token, commitsQuery(publicRepos))) as any[];
  for (const repo of repos) {
    // Checked again here in case a repo went private between the two requests.
    if (!repo || repo.isPrivate !== false) continue;
    const mine = repo.defaultBranchRef?.target?.history?.nodes?.[0];
    if (!mine) continue;
    const date = new Date(mine.committedDate);
    if (newest && newest.date >= date) continue;
    newest = { headline: mine.messageHeadline, repo: repo.nameWithOwner, url: mine.url, date };
  }
  return newest;
}

interface Cached {
  commit: (Omit<LatestCommit, "date"> & { date: string }) | null;
  fetchedAt: number;
}

export type GitCacheState = "fresh" | "stale" | "miss" | "off";

// Stored in KV next to the presence report, so every edge location shares one answer.
const KV_KEY = "github:latest";
let refreshing: Promise<Cached> | null = null;

async function refresh(env: any, previous: Cached | null): Promise<Cached> {
  let entry: Cached;
  try {
    const commit = await fetchNewest(env);
    entry = { commit: commit && { ...commit, date: commit.date.toISOString() }, fetchedAt: Date.now() };
  } catch (err) {
    console.error("github latest commit failed", err);
    // Keep showing the last answer and wait a full TTL before trying again.
    entry = { commit: previous?.commit ?? null, fetchedAt: Date.now() };
  }
  await env.SESSION.put(KV_KEY, JSON.stringify(entry));
  return entry;
}

// Returns the stored answer at once and, when it is older than CACHE_TTL_MS, refreshes
// it after the response is sent. Only when nothing is stored yet (a new KV namespace)
// does a reader wait for GitHub.
export async function getLatestPublicCommit(
  env: any,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<{ commit: LatestCommit | null; cache: GitCacheState }> {
  if (!env.GITHUB_TOKEN || !env.SESSION) return { commit: null, cache: "off" };
  let cached: Cached | null = await env.SESSION.get(KV_KEY, { type: "json", cacheTtl: 30 });
  let state: GitCacheState = "fresh";
  if (!cached) {
    state = "miss";
    cached = await (refreshing ??= refresh(env, null).finally(() => (refreshing = null)));
  } else if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
    state = "stale";
    if (!refreshing) {
      refreshing = refresh(env, cached).finally(() => (refreshing = null));
      waitUntil(refreshing);
    }
  }
  const commit = cached?.commit ? { ...cached.commit, date: new Date(cached.commit.date) } : null;
  return { commit, cache: state };
}
