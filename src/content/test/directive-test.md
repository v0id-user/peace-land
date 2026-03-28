---
title: "Directive Test"
date: 2026-03-28
slug: directive-test
---

This post tests the custom markdown directives.

:::note
This is a note. It provides additional context or a helpful aside without breaking the flow of the text. Think of it as a gentle tap on the shoulder.
:::

Some regular text between directives.

:::warning
This is a warning. Something important that you should not ignore. Proceeding without reading this may lead to pain.
:::

::sep

## Diagrams

:::diagram[SWC Transform Pipeline]
Your Code → SWC Plugin → Wrapped Functions → Runtime
:::

:::diagram[Request Flow]
Client → Edge → Worker → KV Store → Response
:::

:::diagram[Build Pipeline]
Markdown → Remark → HTML → Astro → Static Files → Cloudflare
:::

::sep

## TL;DR

:::tldr
The system works by intercepting function calls at compile time, wrapping each step in a durable checkpoint, and replaying from cached results on retry. No client-side JavaScript required.
:::

::sep

## Code Labels

::codelabel[server.ts]

```typescript
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    return new Response(`Hello from ${url.pathname}`);
  },
};
```

::codelabel[config.json]

```json
{
  "name": "peace-land",
  "main": "dist/server/_worker.js"
}
```

That's it. All directives in action.
