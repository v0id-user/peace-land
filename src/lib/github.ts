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

let cache: { commit: LatestCommit | null; fetchedAt: number } | null = null;

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

export async function getLatestPublicCommit(env: any): Promise<LatestCommit | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.commit;

  const token = env.GITHUB_TOKEN;
  if (!token) return null;

  try {
    const skip = new Set(
      String(env.GITHUB_SKIP_OWNERS ?? "").split(",").map((o) => o.trim().toLowerCase()).filter(Boolean),
    );
    const contributed = await graphql(token, REPOS_QUERY, { login: LOGIN });
    const publicRepos: string[] = (contributed.user?.contributionsCollection?.commitContributionsByRepository ?? [])
      .map((c: any) => c.repository)
      .filter((r: any) => r && r.isPrivate === false)
      .map((r: any) => r.nameWithOwner as string)
      .filter((name) => !skip.has(name.split("/")[0].toLowerCase()));

    let newest: LatestCommit | null = null;
    if (publicRepos.length > 0) {
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
    }
    cache = { commit: newest, fetchedAt: Date.now() };
    return newest;
  } catch (err) {
    console.error("github latest commit failed", err);
    cache = { commit: cache?.commit ?? null, fetchedAt: Date.now() };
    return cache.commit;
  }
}
