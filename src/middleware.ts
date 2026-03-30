import { defineMiddleware } from 'astro:middleware';
import { PGP_PUBLIC_KEY_ARMORED } from './lib/pgpKey';

/**
 * Subdomain routing in dev (prod: worker entry in pgp-subdomain-worker-entry integration).
 * tree/pgp/gpg non-root -> www. tree / -> /tree. pgp/gpg / -> raw key.
 */
const RAW_KEY_HOSTS = new Set(['pgp.v0id.me', 'gpg.v0id.me']);
const TREE_HOST = 'tree.v0id.me';
const SUBDOMAIN_HOSTS = new Set(['tree.v0id.me', 'pgp.v0id.me', 'gpg.v0id.me']);
const CANONICAL_WWW = 'https://www.v0id.me';

export const onRequest = defineMiddleware(async (context, next) => {
  const host = context.request.headers.get('host')?.split(':')[0]?.toLowerCase();
  const url = new URL(context.request.url);

  if (host && SUBDOMAIN_HOSTS.has(host)) {
    if (url.pathname !== '/' && url.pathname !== '') {
      const dest = new URL(CANONICAL_WWW);
      dest.pathname = url.pathname;
      dest.search = url.search;
      return Response.redirect(dest.toString(), 301);
    }
  }

  if (host === TREE_HOST && context.request.method === 'GET') {
    if (url.pathname === '/' || url.pathname === '') {
      return next(new URL('/tree', context.url));
    }
  }

  if (!host || !RAW_KEY_HOSTS.has(host)) {
    return next();
  }

  if (context.request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (url.pathname === '/' || url.pathname === '') {
    return new Response(PGP_PUBLIC_KEY_ARMORED, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  return next();
});
