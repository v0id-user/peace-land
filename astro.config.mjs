// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import remarkDirective from 'remark-directive';
import { remarkCallouts } from './src/plugins/remark-callouts.ts';

export default defineConfig({
  adapter: cloudflare(),
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
    remarkPlugins: [remarkDirective, remarkCallouts],
  },
});
