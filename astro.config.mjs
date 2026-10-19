// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import remarkDirective from 'remark-directive';
import { remarkCallouts } from './src/plugins/remark-callouts.ts';
import { remarkUnescape } from './src/plugins/remark-unescape.ts';
import pgpSubdomainWorkerEntry from './src/integrations/pgp-subdomain-worker-entry.js';

export default defineConfig({
  site: 'https://www.v0id.me',
  integrations: [pgpSubdomainWorkerEntry(), sitemap({
    filter: (page) => !['/now-playing', '/human/', '/test/', '/cv'].some((path) => new URL(page).pathname.startsWith(path)),
  })],
  adapter: cloudflare(),
  // Astro's check refuses form posts without a matching Origin header, which blocks
  // `curl -d ... v0id.me/guestbook`. The guestbook checks Origin itself instead, and
  // is the only route that takes form posts.
  security: { checkOrigin: false },
  // The toolbar also renders inside the sidebar iframe and covers it.
  devToolbar: { enabled: false },
  build: {
    // global.css (~6.5KB) exceeds Vite's default inline limit (~4KB), so "auto"
    // emitted Base.*.css as render-blocking. Inline to avoid an extra round-trip.
    inlineStylesheets: 'always',
  },
  vite: {
    server: {
      allowedHosts: ['pgp.v0id.me', 'gpg.v0id.me', 'tree.v0id.me'],
    },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
    remarkPlugins: [remarkUnescape, remarkDirective, remarkCallouts],
  },
});
