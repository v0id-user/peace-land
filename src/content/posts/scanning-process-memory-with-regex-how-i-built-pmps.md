---
title: 'Scanning process memory with regex: How I built PMPS'
date: 2024-05-19
slug: scanning-process-memory-with-regex-how-i-built-pmps
draft: false
---

A while back I got obsessed with something: no matter how well you hide sensitive data in software, the memory always tells the truth.

That thought turned into PMPS, a C library and tool for scanning a Windows process's memory space using regex patterns. You give it a process name and a pattern, it walks through virtual memory page by page (4KB at a time) and hands you back the matched block.

The whole thing runs on top of `VirtualQueryEx`, the Windows API that lets you query virtual memory regions of another process. No kernel-level access needed, no full memory dumps to disk, just walking pages.

:::note

PMPS searches *virtual* memory, not physical memory directly. It starts at base address `0x0` and walks to the end of the virtual address space, one page at a time.

:::

::sep

## Why 4KB Pages?

Memory pages on Windows are typically 4KB aligned. Searching at that granularity gives you natural boundaries, and in all my testing I didn't lose data to cuts at page edges. This tradeoff is baked in right now, but a future version should let you configure the search size.

:::warning

Page-boundary cuts can still happen in theory. If your pattern spans two pages you might miss it. It's a known limitation and it's documented in the repo.

:::

::sep

## The Interesting Part: What You Can Find

This is where it gets real. Here are three things you can actually do with this:

**1. Digging tokens out of Discord**

Send a message in Discord, run PMPS against `discord.exe` with a pattern like `my password:\s*`, and watch the authorization token show up in the matched page dump. No injection, no hooks, just reading memory that was already there.

**2. Detecting debuggers without checking process names**

Most anti-debug code checks for process names or window titles. Those are trivially bypassable by renaming the process. PMPS takes a different angle: IDA has strings like "IDA Freeware" sitting in its memory. Pattern-match against that and you find the debugger regardless of what it's called.

```c
pm_t* pm = PMSearchAllForMatch("[Ii][Dd][Aa] [Ff]reeware\s*", TRUE);
printf("App name: %s\n", pm->exeName);
// output: ida64.exe
```

**3. Hunting malware at runtime**

Malware often obfuscates domains at rest and decrypts them at runtime. That means even if the binary looks clean, the deobfuscated string *has* to exist in memory at some point. Patterns like `*.ddns.net` catch that.

:::diagram[Memory Walk Flow]

Process Start (0x0) → VirtualQueryEx → Readable Page? → Run Regex → Match Found → Return Block

:::

::sep

## The API Is Simple on Purpose

```c
pm_t* pm = CreateProcessMatcher("[Hh]ey");
GetProcessHandleByName(pm, "target.exe");
char* block = PMFindMatchBlock(pm);
while (block != NULL) {
    printf("%s\n", block);
    block = PMFindMatchBlock(pm); // stateful, keeps walking
}
CleanupProcessMatcher(pm);
```

The state lives in the `pm_t` struct. Call `PMFindMatchBlock` again and it picks up where it left off. No restarting, no re-scanning from scratch.

:::note

The buffers `stringBuffer` and `memDumpBuffer` are fixed 4KB heap allocations. They get overwritten on every call. If you need to hold the data, copy it yourself.

:::

::sep

## What I'd Do Differently Now

A few things I'd revisit:

- The regex engine is `tiny-regex-c` by kokke, which is great for embedded use but has limited syntax. A more complete engine would open up more use cases
- Fixed page size is a real constraint. Parameterizing the scan size is the obvious next step
- Windows-only. A cross-platform version using `/proc/<pid>/maps` on Linux would be interesting

::sep

## TLDR

:::tldr

PMPS walks a Windows process's virtual memory page by page, runs a regex on each page, and returns the matching block. Useful for memory forensics, anti-debug detection, and malware analysis. No kernel access required.

:::

The repo is at [GhaynOrg/PMPS](https://github.com/GhaynOrg/PMPS) if you want to poke at the code.
