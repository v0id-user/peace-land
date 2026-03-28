This is #V0ID Official Site and Blog.
https://www.v0id.me

How it works:

  Blog engine:
    Astro builds markdown files into static HTML.
    Cloudflare Workers serves them. Zero JS shipped to readers.
    Push to main, it deploys automatically. Costs $0.

  Editing:
    Go to /admin, log in with GitHub, write posts in the browser.
    Sveltia CMS handles the editor UI. It commits markdown to this repo.

  Auth flow:
    You click "Login with GitHub" on /admin.
    Sveltia CMS redirects to a small Cloudflare Worker (sveltia-cms-auth).
    That worker sends you to GitHub OAuth.
    GitHub sends back a code.
    The worker exchanges the code for a token.
    Token goes back to the CMS in your browser.
    Now you can read/write to this repo through the editor.

  Posts live in:
    src/content/posts/*.md
