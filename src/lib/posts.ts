import { getCollection } from 'astro:content';

export async function publishedPosts() {
  return (await getCollection('posts', ({ data }) => import.meta.env.PROD ? data.draft !== true : true))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

// Minutes to read a post, at about 220 words a minute.
export const readMinutes = (body: string | undefined) => Math.max(1, Math.round((body ?? '').split(/\s+/).length / 220));

export const postURL = (slug: string) => `https://www.v0id.me/posts/${slug}/`;
