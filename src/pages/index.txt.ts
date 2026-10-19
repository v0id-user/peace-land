import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getLatestPublicCommit } from '../lib/github';
import { getPresence } from '../lib/presence';
import { postURL, publishedPosts } from '../lib/posts';
import { statusText, statusWord } from '../lib/status';
import { text } from '../lib/terminal';

export const prerender = false;

// What `curl v0id.me` prints (src/middleware.ts sends terminals here). The mark is
// public/favicon.svg drawn with half blocks, two characters per pixel.
const MARK = `
  ██████                ██████
  ▀▀████▄▄            ▄▄████▀▀
    ▀▀████▄▄        ▄▄████▀▀
        ▀▀████▄▄▄▄████▀▀
            ▀▀████▀▀

  #V0ID  Fahad Al-Ghamdi
`;

export const GET: APIRoute = async ({ locals }) => {
  const mergedEnv: any = { ...import.meta.env, ...env };
  const [git, presence, posts] = await Promise.all([
    getLatestPublicCommit(mergedEnv, (p) => locals.cfContext?.waitUntil(p)),
    getPresence(mergedEnv.SESSION),
    publishedPosts(),
  ]);
  const latest = posts[0];
  const body = [
    MARK,
    statusText(presence, git.commit),
    `latest  ${latest.data.title}`,
    `        ${postURL(latest.data.slug)}`,
    '',
    'more    curl v0id.me/posts',
    '',
  ].join('\n');
  const word = statusWord(presence);
  return text(body, { headers: word ? { 'x-fahad': word } : {} });
};
