import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { OG_HEIGHT, OG_WIDTH, escapeXml, png, wrap } from '../../lib/og';
import { publishedPosts, readMinutes } from '../../lib/posts';

export const prerender = false;

// A post's link preview, drawn like the site: the menu bar with the mark, and the post
// as a window on the dithered desktop, titled like a file, with its reading time and date.
const FG = '#e8e8e8';
// The favicon's mark (src/components/Pixel.astro), on its own 448x320 grid.
const MARK: [number, number, number, number][] = [
  [32, 96, 96, 96], [64, 192, 96, 64], [96, 256, 96, 32], [128, 288, 96, 32],
  [384, 96, 96, 96], [352, 192, 96, 64], [320, 256, 96, 32], [288, 288, 96, 32],
  [160, 320, 192, 32], [192, 352, 128, 32], [224, 384, 64, 32],
];

export const GET: APIRoute = async ({ params, url }) => {
  const post = (await publishedPosts()).find((p) => p.data.slug === params.slug);
  if (!post) return new Response(null, { status: 404 });

  // Cut like the title bar's ellipsis, so the name stays inside the window.
  const name = `${post.data.slug}.txt`;
  const file = escapeXml(name.length > 60 ? `${name.slice(0, 57)}...` : name);
  const meta = escapeXml(`${readMinutes(post.body)} min read`);
  const date = post.data.date.toISOString().slice(0, 10);
  const title = wrap(post.data.title, 28, 3)
    .map((l, i) => `<tspan x="110" dy="${i === 0 ? 0 : 76}">${escapeXml(l)}</tspan>`)
    .join('');
  const mark = MARK.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('');

  // Window box: x 70..1130, y 110..575; title bar 48px; info strip below it.
  const fileWidth = file.length * 13.3 + 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" shape-rendering="crispEdges">
  <defs>
    <pattern id="dither" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#000"/>
      <rect width="4" height="4" fill="#333"/>
      <rect x="4" y="4" width="4" height="4" fill="#333"/>
    </pattern>
    <pattern id="stripes" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="#000"/>
      <rect width="6" height="2" fill="${FG}"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#dither)"/>

  <rect width="${OG_WIDTH}" height="58" fill="#000"/>
  <rect y="58" width="${OG_WIDTH}" height="2" fill="${FG}"/>
  <g transform="translate(40 15) scale(0.09375) translate(-32 -96)" fill="${FG}">${mark}</g>
  <text x="96" y="39" font-family="DejaVu Sans" font-weight="bold" font-size="24" fill="${FG}">#V0ID</text>
  <text x="1160" y="39" text-anchor="end" font-family="DejaVu Sans Mono" font-size="22" fill="${FG}">v0id.me</text>

  <rect x="76" y="116" width="1060" height="465" fill="${FG}"/>
  <rect x="70" y="110" width="1060" height="465" fill="#000" stroke="${FG}" stroke-width="2"/>
  <rect x="80" y="121" width="1040" height="26" fill="url(#stripes)"/>
  <rect x="71" y="157" width="1058" height="2" fill="${FG}"/>
  <rect x="94" y="117" width="38" height="34" fill="#000"/>
  <rect x="${600 - fileWidth / 2}" y="117" width="${fileWidth}" height="34" fill="#000"/>
  <rect x="100" y="121" width="26" height="26" fill="#000" stroke="${FG}" stroke-width="2"/>
  <text x="600" y="142" text-anchor="middle" font-family="DejaVu Sans Mono" font-size="22" fill="${FG}">${file}</text>

  <text x="94" y="194" font-family="DejaVu Sans Mono" font-size="22" fill="${FG}">${meta}</text>
  <text x="1106" y="194" text-anchor="end" font-family="DejaVu Sans Mono" font-size="22" fill="${FG}">${date}</text>
  <rect x="71" y="210" width="1058" height="2" fill="${FG}"/>
  <rect x="71" y="216" width="1058" height="2" fill="${FG}"/>

  <text x="110" y="310" font-family="DejaVu Sans" font-weight="bold" font-size="60" fill="#ffffff">${title}</text>
</svg>`;
  return png(svg, { ...import.meta.env, ...env }, url.origin);
};
