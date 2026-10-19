import { getCollection } from 'astro:content';

export async function publishedPosts() {
  return (await getCollection('posts', ({ data }) => import.meta.env.PROD ? data.draft !== true : true))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export const postURL = (slug: string) => `https://www.v0id.me/posts/${slug}/`;
