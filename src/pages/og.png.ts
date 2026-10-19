import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getLatestPublicCommit } from '../lib/github';
import { OG_HEIGHT, OG_WIDTH, escapeXml, png } from '../lib/og';
import { getPresence } from '../lib/presence';
import { statusText } from '../lib/status';

export const prerender = false;

// The home page's link preview: the name, the status block as it was when the link
// was shared, and the address.
export const GET: APIRoute = async ({ locals, url }) => {
  const mergedEnv: any = { ...import.meta.env, ...env };
  const [git, presence] = await Promise.all([
    getLatestPublicCommit(mergedEnv, (p) => locals.cfContext?.waitUntil(p)),
    getPresence(mergedEnv.SESSION),
  ]);
  // The sidebar's rows, without the working/idle split, which is too fine for a card.
  const rows = statusText(presence, git.commit).split('\n').filter((l) => l && !/^ {9}/.test(l));
  const status = rows
    .map((l, i) => `<tspan x="75" dy="${i === 0 ? 0 : 41}" xml:space="preserve">${escapeXml(l)}</tspan>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="75" y="140" font-family="DejaVu Sans" font-weight="bold" font-size="66" fill="#000000">#V0ID</text>
  <text x="75" y="290" font-family="DejaVu Sans Mono" font-size="30" fill="#111111">${status}</text>
  <text x="75" y="555" font-family="DejaVu Sans Mono" font-size="28" fill="#777777">v0id.me</text>
</svg>`;
  return png(svg, mergedEnv, url.origin);
};
