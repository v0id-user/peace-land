const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";
const LOGIN = "v0id-user";
const CACHE_TTL_MS = 5 * 60_000;

export interface LatestCommit {
  headline: string;
  repo: string;
  url: string;
  date: Date;
}

let cache: { commit: LatestCommit | null; fetchedAt: number } | null = null;

// GITHUB_TOKEN can read the private writings repo, so the query asks for
// privacy: PUBLIC and the private repos never reach this code at all.
// The newest of my own commits on the default branch of my five most recently
// pushed public repos. Bot commits (dependabot and friends) are skipped.
const QUERY = `query($login: String!) {
  user(login: $login) {
    repositories(first: 5, privacy: PUBLIC, isFork: false, ownerAffiliations: OWNER,
                 orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes {
        name
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 10) {
                nodes { messageHeadline committedDate url author { user { login } } }
              }
            }
          }
        }
      }
    }
  }
}`;

export async function getLatestPublicCommit(env: any): Promise<LatestCommit | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.commit;

  const token = env.GITHUB_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "peace-land",
      },
      body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
    });
    const json: any = await res.json();
    if (!res.ok || json.errors?.length) {
      console.error("github latest commit failed", res.status, json.errors?.[0]?.message);
      cache = { commit: cache?.commit ?? null, fetchedAt: Date.now() };
      return cache.commit;
    }

    let newest: LatestCommit | null = null;
    for (const repo of json.data?.user?.repositories?.nodes ?? []) {
      const mine = (repo.defaultBranchRef?.target?.history?.nodes ?? []).find(
        (c: any) => c.author?.user?.login === LOGIN,
      );
      if (!mine) continue;
      const date = new Date(mine.committedDate);
      if (newest && newest.date >= date) continue;
      newest = { headline: mine.messageHeadline, repo: repo.name, url: mine.url, date };
    }
    cache = { commit: newest, fetchedAt: Date.now() };
    return newest;
  } catch (err) {
    console.error("github latest commit threw", err);
    cache = { commit: cache?.commit ?? null, fetchedAt: Date.now() };
    return cache.commit;
  }
}
