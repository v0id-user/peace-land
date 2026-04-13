import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET() {
  const posts = (await getCollection('posts', ({ data }) => {
    return data.draft !== true;
  })).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime()
  );

  return rss({
    title: '#V0ID',
    description: 'Technical blog by #V0ID — backend engineering, Rust, TypeScript, Cloudflare, and systems programming.',
    site: 'https://www.v0id.me',
    items: posts.slice(0, 50).map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      link: `/posts/${post.data.slug}/`,
    })),
  });
}
