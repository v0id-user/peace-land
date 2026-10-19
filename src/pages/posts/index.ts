import type { APIRoute } from 'astro';
import { postURL, publishedPosts } from '../../lib/posts';
import { isTerminal, text } from '../../lib/terminal';

export const prerender = false;

// `curl v0id.me/posts` lists every post. In a browser the list is the home page.
export const GET: APIRoute = async ({ request, redirect }) => {
  if (!isTerminal(request)) return redirect('/', 302);
  const posts = await publishedPosts();
  const lines = posts.flatMap((p) => [
    `${p.data.date.toISOString().slice(0, 10)}  ${p.data.title}`,
    `            ${postURL(p.data.slug)}`,
  ]);
  return text(lines.join('\n') + '\n');
};
