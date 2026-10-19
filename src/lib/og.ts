// Link preview images (og:image), drawn on the Worker: an SVG of a few text lines,
// rendered to PNG by resvg. Fonts are DejaVu (public/og), close to the site's Verdana
// and Courier, which cannot be redistributed. They are fetched from the static assets
// on first use so they do not weigh on every other route.
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import wasm from '@resvg/resvg-wasm/index_bg.wasm';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

let ready: Promise<Uint8Array[]> | null = null;

function setup(env: any, origin: string): Promise<Uint8Array[]> {
  ready ??= (async () => {
    await initWasm(wasm);
    return Promise.all(
      ['/og/DejaVuSans-Bold.ttf', '/og/DejaVuSansMono.ttf'].map(async (path) => {
        const url = new URL(path, origin);
        const res = env.ASSETS ? await env.ASSETS.fetch(url) : await fetch(url);
        if (!res.ok) throw new Error(`font ${path}: ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
      }),
    );
  })().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

export const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Greedy word wrap by character count; DejaVu Sans Bold averages about 0.62em a glyph.
export function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '...';
  }
  return lines;
}

export async function png(svg: string, env: any, origin: string): Promise<Response> {
  const fontBuffers = await setup(env, origin);
  const image = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
    font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans Mono' },
  }).render();
  return new Response(image.asPng(), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' },
  });
}
