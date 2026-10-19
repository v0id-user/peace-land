import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getPresence } from '../lib/presence';
import { statusWord, type StatusWord } from '../lib/status';

export const prerender = false;

// The pixel mark, black while I am active, gray while away, pale while inactive.
// Browsers fetch it when a page loads, so it shows the status at that moment.
const FILL: Record<StatusWord, string> = { active: '#000000', away: '#888888', inactive: '#cccccc' };

const svg = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" shape-rendering="crispEdges">
  <rect width="512" height="512" fill="#ffffff"/>
  <g fill="${fill}">
    <rect x="32" y="96" width="96" height="96"/>
    <rect x="64" y="192" width="96" height="64"/>
    <rect x="96" y="256" width="96" height="32"/>
    <rect x="128" y="288" width="96" height="32"/>
    <rect x="384" y="96" width="96" height="96"/>
    <rect x="352" y="192" width="96" height="64"/>
    <rect x="320" y="256" width="96" height="32"/>
    <rect x="288" y="288" width="96" height="32"/>
    <rect x="160" y="320" width="192" height="32"/>
    <rect x="192" y="352" width="128" height="32"/>
    <rect x="224" y="384" width="64" height="32"/>
  </g>
</svg>
`;

export const GET: APIRoute = async () => {
  const word = statusWord(await getPresence((env as any).SESSION));
  return new Response(svg(word ? FILL[word] : FILL.active), {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=60' },
  });
};
