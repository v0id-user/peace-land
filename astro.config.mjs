// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import remarkDirective from 'remark-directive';
import { remarkCallouts } from './src/plugins/remark-callouts.ts';
import pgpSubdomainWorkerEntry from './src/integrations/pgp-subdomain-worker-entry.js';

export default defineConfig({
  integrations: [pgpSubdomainWorkerEntry()],
  adapter: cloudflare(),
  vite: {
    server: {
      allowedHosts: ['pgp.v0id.me', 'gpg.v0id.me', 'tree.v0id.me'],
    },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
    remarkPlugins: [remarkDirective, remarkCallouts],
  },
});
