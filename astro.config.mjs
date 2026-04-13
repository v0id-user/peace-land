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
    filter: (page) => !page.includes('/now-playing') && !page.includes('/human/confirm'),
  })],
  adapter: cloudflare(),
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
