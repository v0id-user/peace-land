import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getLatestPublicCommit } from '../lib/github';
import { getPresence } from '../lib/presence';
import { statusText, statusWord } from '../lib/status';

export const prerender = false;

// The sidebar's status block as plain text: curl https://www.v0id.me/status
export const GET: APIRoute = async ({ locals }) => {
  const mergedEnv: any = { ...import.meta.env, ...env };
  const [git, presence] = await Promise.all([
    getLatestPublicCommit(mergedEnv, (p) => locals.cfContext?.waitUntil(p)),
    getPresence(mergedEnv.SESSION),
  ]);
  const headers = new Headers({
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  const word = statusWord(presence);
  if (word) headers.set('x-fahad', word);
  return new Response(statusText(presence, git.commit), { headers });
};
