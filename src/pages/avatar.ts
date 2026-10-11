import type { APIRoute } from 'astro';

export const prerender = false;

// 48px is twice the 24px the sidebar shows, for HiDPI screens.
const GITHUB_AVATAR = 'https://avatars.githubusercontent.com/u/172490913?s=48';

// Proxied through the Worker so readers never open a connection to GitHub,
// while a new GitHub avatar still shows up within an hour.
export const GET: APIRoute = async () => {
  const upstream = await fetch(GITHUB_AVATAR, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!upstream.ok) {
    return Response.redirect(GITHUB_AVATAR, 302);
  }
  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
