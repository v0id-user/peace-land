---
title: "Syntax Highlighting"
date: 2026-03-28
slug: syntax-highlighting
---

Testing syntax highlighting across multiple languages.

## TypeScript

::codelabel[worker.ts]

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cache = caches.default;
    let response = await cache.match(request);

    if (!response) {
      response = new Response(`Hello from ${url.pathname}`, {
        headers: { 'Content-Type': 'text/plain' },
      });
      await cache.put(request, response.clone());
    }

    return response;
  },
};
```

## Rust

::codelabel[main.rs]

```rust
use std::collections::HashMap;

fn main() {
    let mut map: HashMap<String, u32> = HashMap::new();
    map.insert("hello".to_string(), 42);

    match map.get("hello") {
        Some(val) => println!("Found: {}", val),
        None => println!("Not found"),
    }
}
```

## Go

::codelabel[server.go]

```go
package main

import (
    "fmt"
    "net/http"
)

func handler(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello from %s", r.URL.Path)
}

func main() {
    http.HandleFunc("/", handler)
    http.ListenAndServe(":8080", nil)
}
```

## Python

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "hello world"}

@app.get("/items/{item_id}")
async def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}
```

## C++

```cpp
#include <kj/async.h>
#include <workerd/jsg/jsg.h>

class MyApiObject : public jsg::Object {
public:
    static jsg::Ref<MyApiObject> constructor() {
        return jsg::alloc<MyApiObject>();
    }

    kj::StringPtr hello() {
        return "world"_kj;
    }

    JSG_RESOURCE_TYPE(MyApiObject) {
        JSG_METHOD(hello);
    }
};
```

## JSON

```json
{
  "name": "peace-land",
  "version": "1.0.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build"
  }
}
```

## Shell

```bash
#!/bin/bash
echo "Building..."
npm run build
npx wrangler deploy -c dist/server/wrangler.json
echo "Deployed!"
```

## SQL

```sql
SELECT p.title, p.date, u.name AS author
FROM posts p
JOIN users u ON p.author_id = u.id
WHERE p.published = true
ORDER BY p.date DESC
LIMIT 10;
```

## Plain (no language hint)

```
src/workerd/
  jsg/       ← C++ ↔ V8 binding framework
  api/       ← All the JS APIs
  io/        ← I/O layer
  server/    ← Entry point
```
