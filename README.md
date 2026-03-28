<div align="center">

[![MADE BY #V0ID](https://img.shields.io/badge/MADE%20BY%20%23V0ID-F3EEE1.svg?style=for-the-badge)](https://github.com/v0id-user)

# peace-land

My personal blog. Static, serverless, ~$0/month.

Built with [Astro](https://astro.build) and deployed on [Cloudflare Workers](https://workers.cloudflare.com).

Editing handled by [Sveltia CMS](https://github.com/sveltia/sveltia-cms) at `/admin`.

---

### Stack

**Astro** — static site generator, ships zero JavaScript to readers.

**Cloudflare Workers** — serverless hosting with native Git CI/CD on push to `main`.

**Sveltia CMS** — open-source Git-backed CMS, drop-in Decap CMS replacement. Lives at `/admin`, authenticates via GitHub OAuth.

**sveltia-cms-auth** — a separate [Cloudflare Worker](https://github.com/sveltia/sveltia-cms-auth) that handles the GitHub OAuth handshake for the CMS.

---

### Structure

```
src/content/posts/    ← blog posts as markdown files
src/layouts/          ← base HTML layout
src/pages/            ← index + post routes
src/styles/           ← plain CSS, no frameworks
public/admin/         ← Sveltia CMS config + entry point
```

---

### Writing a post

**Option A** — go to `/admin`, log in with GitHub, write in the browser. It commits to this repo automatically.

**Option B** — create a `.md` file in `src/content/posts/`:

```markdown
---
title: "Post Title"
date: 2026-01-01
slug: post-title
---

Your content here.
```

Push to `main`. Cloudflare builds and deploys automatically.

---

### Local development

```sh
npm install
npm run dev
```

---

### Design

System default fonts. Solid white background, solid black text. Sidebar navigation. No JavaScript. Inspired by the web circa 2003.

</div>
