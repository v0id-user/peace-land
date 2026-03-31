---
title: "Exploring Cloudflare's Workerd Runtime: From Source to Custom API"
date: 2026-03-28
slug: exploring-cloudflares-workerd
description: Digging into the Cloudflare Workers runtime source code — building workerd from scratch and adding a custom C++ API.
---

# Why?

[Cloudflare Workers](https://workers.cloudflare.com/) are basically magic. They handle shit ton of load, they're easy to deploy to, easy to work with. They just work. In this blog post I'm trying to scratch the surface of their actual code internals to understand what I'm running my code on top of, and to deepen my understanding of the thing I deploy to every time I'm building something of my own.

# What is it?

It's a C++ server built on top of V8 (the same engine behind Chrome and Node.js). It's the open-source version of the Cloudflare Workers Runtime. When you upload your JS or WASM, it runs inside an isolated V8 instance within the workerd server. But all the built-in APIs (fetch, Request, crypto, etc.) are implemented in C++ and exposed to JavaScript through a custom binding layer called JSG (JavaScript Glue).

Workerd's main selling point is isolation and its event-driven model. Each request that comes through the Cloudflare network runs in its own V8 isolate. This is why it's serverless and fast. State is ephemeral, and spinning up a V8 isolate to execute JS/WASM instructions is a lot faster than spinning up a VM the way Lambda does on AWS via Firecracker.

This comes with limitations. You're cornered into web technologies and certain programming languages and patterns. The strict isolation model, contracts, and APIs make it harder to migrate to something else, as the entire contract needs to be redefined. Workerd becomes the only guarantee for that contract. On the other hand, it gives you much larger scale with lower latency. Global distribution becomes the default, not an afterthought.

Workerd uses Cap'n Proto for its configuration, which is a schema language, serialization format, and RPC system all in one. It gives you type safety at compile time, zero-copy reads (the binary format is the in-memory format, no parsing step), built-in RPC, and code generation.

In this blog post, I'm going to explore the source code, identify entry points, and build my own function to print a string. Just to get my hands dirty and rip the blackbox open.


# Problem

What does workerd even try to solve? Why would you bother building this, sinking thousands of hours into it? What problem did Cloudflare need to solve?

It's actually simple. You want to run millions of users' code on your servers. That's Cloudflare's business. How do you do it?

Option A: Containers/VMs. Spin up a container per user. Heavy, slow cold starts, wastes memory. Doesn't scale to millions.

Option B: V8 isolates. V8 already solved the "run untrusted code safely" problem for browser tabs. Each tab is isolated. So instead of a whole container per user, you spin up a lightweight V8 isolate. 

Thousands can fit in one process. Microsecond cold starts. Memory efficient.

That's workerd. A server that manages V8 isolates. Each worker is basically a browser tab without the browser.

But why build custom APIs? Because there's no DOM, no window, no browser. You need server-side primitives: fetch, Request, Response, crypto, KV storage, Durable Objects. Those don't exist in raw V8. So they built them in C++ and used JSG to glue them into JavaScript.

And why Cap'n Proto? You need a way to configure which worker listens on which port, with what bindings. Cap'n Proto is the config format and the internal serialization. It's fast, zero-copy, and it was created by Kenton Varda, the same person who created protobuf at Google and later built workerd at Cloudflare. He wasn't going to use someone else's tool when he wrote the better version.

# Mental Model

Workerd is event-driven. It's similar to a browser tab. Each request comes through and runs in its own isolated environment via V8.

Your code doesn't own the process. Workerd does. You're a guest inside its V8 isolate. You register handlers and workerd calls them when events arrive. That's why your code looks like this:

addEventListener('fetch', event => { ... })

It's the same pattern as the browser. You don't write main() in browser JavaScript. You write addEventListener('click', ...) and the browser calls you. Workerd is the browser, just for HTTP instead of clicks.

This also means your server doesn't actually run. That's a tricky mental model to wrap your head around. You are just a fetch handler being called by workerd. There is no server that runs on a port. It just responds to a fetch event fired by the workerd server on an HTTP request.

[As Sunil puts it: One big stretchy server.](https://x.com/threepointone/status/1446231689081020422)

# Code

Now that we know what workerd is and why it exists, let's open it up. I cloned the repo, built it from source on an M4 MacBook Air (34 minutes, 7685 build actions), and ran the helloworld sample. It returned "Hello World" on localhost:8080. Cool. But what actually happened between me hitting enter on workerd serve config.capnp and that response? That's what this section is about.

We're going to trace the full path: from the config file, through the C++ source, into V8, all the way to your JavaScript executing. Not the docs version. The actual code, with file names and line numbers.


First, let's orient ourselves with the source tree.

Source Tree

```
src/workerd/
  jsg/       ← The "magic glue" — C++ ↔ V8 binding framework (macros, type mappings)
  api/       ← All the JS APIs (fetch, crypto, KV, DO, WebSocket, etc.) — implemented in C++
  io/        ← I/O layer: worker lifecycle, event delivery, network I/O
  server/    ← The top-level server binary — the actual entry point
  util/      ← Random helpers
  tools/     ← Tooling (TypeScript type extractor)
types/       ← TypeScript type generator (reads RTTI → produces .d.ts)
samples/     ← Working examples: helloworld, durable-objects-chat, wasm, etc.
```

The two directories that matter most for understanding the startup chain are jsg/ (where C++ becomes JavaScript) and io/ (where the worker lifecycle lives). The server/ directory is the entry point, but it mostly wires things together. The real work happens in io/ and jsg/.

How It Starts

After you compile the server and run “workerd serve config.capnp”, this is the full chain of what happens inside the binary.

```
workerd serve config.capnp
  │
  ├─ Parse capnp config
  │    └─ workerd.capnp schema defines serviceWorkerScript field
  │
  ├─ extractSource()                          [workerd-api.c++]
  │    └─ conf.getServiceWorkerScript()
  │    └─ builds ScriptSource struct          [worker-source.h]
  │
  ├─ Worker::Script constructor               [worker.c++:1453]
  │    └─ compileServiceWorkerGlobals()        (WASM, data bindings)
  │    └─ NonModuleScript::compile()           [script.c++:17]
  │         └─ v8::ScriptCompiler::Source()
  │         └─ v8::ScriptCompiler::CompileUnboundScript()
  │         └─ stores as v8::Global<v8::UnboundScript>
  │
  ├─ Worker startup                            [worker.c++:1946]
  │    └─ unboundScript.run(lock)              [script.c++:12]
  │         └─ UnboundScript::BindToCurrentContext()
  │         └─ BoundScript::Run()              ← YOUR JS RUNS
  │    └─ lock.runMicrotasks()                 ← promises flushed
  │
  └─ addEventListener('fetch', handler) is now registered
       └─ workerd listens on port 8080
       └─ HTTP request arrives → handler invoked
```

Let's walk through each step.

## Step 1: The Config

The capnp config file is the wiring diagram. It tells workerd what code to run and where to listen. The schema in workerd.capnp defines two ways to provide JavaScript:

```capnp
serviceWorkerScript @1 :Text;   # single script with addEventListener()
modules @6 :List(Module);        # ES modules with import/export
```

In the samples folder. The helloworld sample uses serviceWorkerScript with embed "worker.js". Cap'n Proto reads the file contents into that text field. The config is type-checked at compile time. If a field is wrong, it fails before anything runs.

## Step 2: Extracting the Source

In “workerd-api.c++”, the function extractSource() parses the config and pulls out your JavaScript:

conf.getServiceWorkerScript()

This builds a ScriptSource struct defined in worker-source.h:

```cpp
struct ScriptSource {
  kj::StringPtr mainScript;            // your actual JavaScript code
  kj::StringPtr mainScriptName;  // script name for stack traces
  kj::Array<Module> globals;       // injected WASM/data bindings
  capnp::List<capnp::schema::Node>::Reader capnpSchemas;
};
```

At this point your JavaScript is just a string being carried through the system.

## Step 3: V8 Compilation

The “Worker::Script” constructor in “worker.c++” receives the ScriptSource and compiles it:

```cpp
KJ_CASE_ONEOF(script, ScriptSource) {
  impl->globals = isolate->getApi()
      .compileServiceWorkerGlobals(lock, script, \*isolate);
  auto limitScope = isolate->getLimitEnforcer()
      .enterStartupJs(lock, limitErrorOrTime);
  impl->unboundScriptOrMainModule =
      jsg::NonModuleScript::compile(lock, script.mainScript, script.mainScriptName);
}
```

The compile call lands in “script.c++”, which is surprisingly small:

```cpp
NonModuleScript NonModuleScript::compile(
    jsg::Lock& js, kj::StringPtr code, kj::StringPtr name) {
  auto isolate = js.v8Isolate;
  v8::ScriptOrigin origin(js.str(name));
  v8::ScriptCompiler::Source source(js.str(code), origin);
  return NonModuleScript(js,
      check(v8::ScriptCompiler::CompileUnboundScript(isolate, &source)));
}
```

Three V8 calls. ScriptOrigin sets up the filename for stack traces. “ScriptCompiler::Source” wraps your code. “CompileUnboundScript” parses and compiles it into V8 bytecode. The result is an UnboundScript, meaning compiled bytecode that is not yet tied to any V8 context. It doesn't know what “Response” or “addEventListener” are yet. That comes next.

A note on “NonModuleScript”:  this is the old Service Worker syntax, the addEventListener('fetch', ...) style. If you use the modern ES module syntax (export default { fetch() {} }), V8 compiles it through a different path using “CompileModule” instead of “CompileUnboundScript”, because modules have imports and exports that need to be resolved. Most Workers today use the module syntax.

## Step 4: Execution

In “worker.c++”, the compiled script is bound to a context and executed:

```cpp
KJ_SWITCH_ONEOF(script->impl->unboundScriptOrMainModule) {
  KJ_CASE_ONEOF(unboundScript, jsg::NonModuleScript) {
    auto limitScope = script->isolate->getLimitEnforcer()
        .enterStartupJs(lock, limitErrorOrTime);
    unboundScript.run(lock);
    lock.runMicrotasks();
  }
}
```

The “run” method in script.c++:

```cpp
void NonModuleScript::run(jsg::Lock& js) const {
  auto boundScript = unboundScript.Get(js.v8Isolate)->BindToCurrentContext();
  check(boundScript->Run(js.v8Context()));
}
```

“BindToCurrentContext” takes the unbound bytecode and connects it to the current V8 context. That context has all the “JSG”-exposed APIs wired into it: (addEventListener, fetch, Response, Request, crypto, everything.) 

Now your script can see them, “Run” executes your JavaScript. This is the moment your addEventListener('fetch', handler) actually registers the handler. 

After that, “runMicrotasks” flushes any pending promises.

Your code is done running. workerd now listens on the configured port and dispatches incoming HTTP requests to the handler you registered.

# Security Mitigation and Sandboxing

Talking about isolation, you might think workerd could serve as a sandbox solution. It can't. The README states this explicitly “WARNING: workerd is not a hardened sandbox.”

Workerd tries to isolate each worker so it can only access the resources it's configured to access. But on its own, it does not contain defense-in-depth against implementation bugs. V8 isolates are instances within the main process. They provide logical isolation, not security isolation. If a bug in V8 allows code to escape the isolate, there's nothing else stopping it.

When running possibly-malicious code, workerd must run inside an appropriate secure sandbox, such as a virtual machine. And that's exactly what Cloudflare does in production. They don't rely on V8 alone. They layer multiple defenses on top of it.

Cloudflare's production security model works in layers. The first layer is V8 isolates themselves, preventing code from accessing memory outside its boundary. The second layer is a process-level sandbox using Linux namespaces and seccomp that blocks all filesystem and network access entirely. A supervisor process mediates all external communication through Unix domain sockets. Workers don't talk to the outside world directly. They talk to the supervisor, and the supervisor decides what's allowed.

The API design itself is a security layer. Workers only get HTTP APIs. No filesystem, no raw sockets, no shell access. If you don't expose an API for something, code can't do it.

Then there's Spectre. V8 is a complex piece of software with a wide attack surface. Instead of trying to fully fix side-channel attacks, Cloudflare chains multiple slowdowns together. Timers are frozen so Date.now() returns the time the request was received, not the current time. Multi-threading is disabled. If suspicious behavior is detected, workers get dynamically moved into their own process, so OS-level Spectre mitigations kick in. Memory is periodically shuffled and workers are rescheduled, forcing any attack to restart from scratch.

None of these measures are a complete fix on their own. But stacked together, they turn theoretical attacks into practically infeasible ones.

Kenton Varda wrote the full breakdown here: [Mitigating Spectre and Other Security Threats: The Cloudflare Workers Security Model.](https://blog.cloudflare.com/mitigating-spectre-and-other-security-threats-the-cloudflare-workers-security-model/)

# Adding your own stuff

To build your own API is actually straightforward. You navigate to `src/workerd/api/` and create your header file, define your class using JSG macros, and wire it up.

Here's the minimal C++ you need to know. A header file (.h) is where you declare your class. `#pragma once` at the top means "only include this file once." `namespace workerd::api` is just a folder for your code so names don't collide.

JSG is the binding layer that turns your C++ into JavaScript. You don't need to understand V8's C++ API. JSG handles all of that. You just use its macros:

`JSG_RESOURCE_TYPE(YourClass)` registers the class as something JavaScript can see.

`JSG_METHOD(name)` exposes a C++ method as `obj.name()` in JavaScript.

`JSG_READONLY_INSTANCE_PROPERTY(name, getter)` exposes a read-only property as obj.name.

`JSG_LAZY_INSTANCE_PROPERTY(name, getter)` same thing but created on first access, used for globals.

KJ is Kenton Varda's utility library. It replaces parts of the C++ standard library. The main thing you'll use for now is `kj::String` (an owned string) and `kj::str()` which builds one. When you write `kj::str("Hello from inside workerd")`, that's KJ creating a string that maps directly to a JavaScript string through JSG.

Here's the full file, `src/workerd/api/v0id.h`:

```cpp
#pragma once
#include "basics.h"
#include <workerd/jsg/jsg.h>
namespace workerd::api {
class V0idFunction final : public jsg::Object {
public:
  kj::String hello() { return kj::str("Hello from inside workerd"); }
  JSG_RESOURCE_TYPE(V0idFunction) {
    JSG_METHOD(hello);
  }
};
#define EW_V0ID_ISOLATE_TYPES api::V0idFunction
}
```

That's it for the code. One class, one method, one macro block. JSG does the rest.

To wire it into workerd you touch three more files:

`src/workerd/api/BUILD.bazel`: add v0id.h to the hdrs list so Bazel knows the file exists

`src/workerd/server/workerd-api.c++`: add `#include <workerd/api/v0id.h>` at the top and `EW_V0ID_ISOLATE_TYPES`, to the isolate types list so the type gets registered with V8

`src/workerd/api/global-scope.h`: add a getter and a `JSG_LAZY_INSTANCE_PROPERTY` so it shows up on the global scope, the same way crypto, scheduler, and caches are exposed

Rebuild with `bazel build //src/workerd/server:workerd`, write a worker that calls v0idFunction.hello(), and you get back "Hello from inside workerd." A string that traveled from C++ through JSG into V8 and out as an HTTP response.

```javascript
export default {
  async fetch(request) {
    return new Response(v0idFunction.hello());
  }
};
```

Every API in workerd follows this exact same pattern. fetch, crypto, caches, Durable Objects, all of them. A C++ class, JSG macros, type registration, global scope wiring. That's how the entire Workers API surface was built, one type at a time.

# Interesting stuff

If you've dealt with Cloudflare you know the CPU limits. The funny thing in this source code, all limits are no-ops. The entire NullIsolateLimitEnforcer does nothing. And that's the cool part about open source. You don't need to open-source everything. You can still keep your business internals private. Same as SQLite's test suite.

# Thanks for reading

That's it! A C++ server, V8 under the hood, JSG gluing it all together, and Cap'n Proto wiring the config. Now when I deploy to Cloudflare Workers, I know what's underneath. Not the docs version. The actual code.

The full source is at github.com/cloudflare/workerd. Go build it yourself :P
