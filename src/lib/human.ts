import { marked } from "marked";

const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";
const REPO_OWNER = "v0id-user";
const REPO_NAME = "peace-land-human";
const CACHE_TTL_MS = 60_000;

export interface HumanEntry {
  title: string;
  date: Date;
  slug: string;
  body: string;
}

let cache: { entries: HumanEntry[]; fetchedAt: number } | null = null;

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body: raw.slice(match[0].length) };
}

function sortTime(date: Date): number {
  const t = date.getTime();
  return Number.isNaN(t) ? 0 : t;
}

export async function getHumanEntries(env: any): Promise<HumanEntry[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.entries;

  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");

  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "peace-land",
    },
    body: JSON.stringify({
      query: `query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          object(expression: "HEAD:") {
            ... on Tree { entries { name object { ... on Blob { text } } } }
          }
        }
      }`,
      variables: { owner: REPO_OWNER, name: REPO_NAME },
    }),
  });
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);

  const json: any = await res.json();
  if (json.errors?.length) throw new Error(`GitHub API error: ${json.errors[0].message}`);

  const files: any[] = json.data?.repository?.object?.entries ?? [];
  const entries = files
    .filter((f) => f.name.endsWith(".md") && typeof f.object?.text === "string")
    .map((f) => {
      const { data, body } = parseFrontmatter(f.object.text);
      const fallback = f.name.replace(/\.md$/, "");
      return {
        title: data.title ?? fallback,
        date: new Date(data.date ?? 0),
        slug: data.slug ?? fallback,
        body,
      };
    })
    .sort((a, b) => sortTime(b.date) - sortTime(a.date));

  cache = { entries, fetchedAt: Date.now() };
  return entries;
}

export async function getHumanEntry(slug: string, env: any): Promise<HumanEntry | null> {
  const entries = await getHumanEntries(env);
  return entries.find((e) => e.slug === slug) ?? null;
}

export function renderHumanMarkdown(body: string): string {
  return marked.parse(body, { async: false }) as string;
}
