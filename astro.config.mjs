// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import remarkDirective from 'remark-directive';
import { remarkCallouts } from './src/plugins/remark-callouts.ts';

export default defineConfig({
  adapter: cloudflare(),
  vite: {
    server: {
      allowedHosts: ['pgp.v0id.me', 'gpg.v0id.me'],
    },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
    remarkPlugins: [remarkDirective, remarkCallouts],
  },
});
