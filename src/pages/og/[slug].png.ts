import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getLatestPublicCommit } from '../../lib/github';
import { OG_HEIGHT, OG_WIDTH, escapeXml, png, wrap } from '../../lib/og';
import { publishedPosts } from '../../lib/posts';
import { getPresence } from '../../lib/presence';
import { ago, sessionsText, statusWord } from '../../lib/status';

export const prerender = false;

// A post's link preview: its title, a one-line status, the address and date.
export const GET: APIRoute = async ({ params, locals, url }) => {
  const post = (await publishedPosts()).find((p) => p.data.slug === params.slug);
  if (!post) return new Response(null, { status: 404 });

  const mergedEnv: any = { ...import.meta.env, ...env };
  const [git, presence] = await Promise.all([
    getLatestPublicCommit(mergedEnv, (p) => locals.cfContext?.waitUntil(p)),
    getPresence(mergedEnv.SESSION),
  ]);
  const word = statusWord(presence);
  const sessions = sessionsText(presence);
  const status = [
    word && `fahad ${word}`,
    sessions?.count,
    git.commit && `git ${ago(git.commit.date.getTime())}`,
  ].filter(Boolean).join(' · ');

  const title = wrap(post.data.title, 32, 3)
    .map((l, i) => `<tspan x="75" dy="${i === 0 ? 0 : 64}">${escapeXml(l)}</tspan>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="75" y="130" font-family="DejaVu Sans" font-weight="bold" font-size="52" fill="#000000">${title}</text>
  <text x="75" y="400" font-family="DejaVu Sans Mono" font-size="25" fill="#777777">${escapeXml(status)}</text>
  <text x="75" y="555" font-family="DejaVu Sans Mono" font-size="28" fill="#777777">v0id.me · ${post.data.date.toISOString().slice(0, 10)}</text>
</svg>`;
  return png(svg, mergedEnv, url.origin);
};
