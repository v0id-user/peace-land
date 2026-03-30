import { defineMiddleware } from 'astro:middleware';
import { PGP_PUBLIC_KEY_ARMORED } from './lib/pgpKey';

/**
 * Raw armored key on pgp.* / gpg.* (prefer pgp in site links).
 * Dev: middleware handles Host. Prod: prerendered `/` skips middleware; see pgp-subdomain-worker-entry integration.
 */
const RAW_KEY_HOSTS = new Set(['pgp.v0id.me', 'gpg.v0id.me']);

export const onRequest = defineMiddleware(async (context, next) => {
  const host = context.request.headers.get('host')?.split(':')[0]?.toLowerCase();
  if (!host || !RAW_KEY_HOSTS.has(host)) {
    return next();
  }

  if (context.request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const url = new URL(context.request.url);
  if (url.pathname === '/' || url.pathname === '') {
    return new Response(PGP_PUBLIC_KEY_ARMORED, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  return new Response('Not Found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
});
