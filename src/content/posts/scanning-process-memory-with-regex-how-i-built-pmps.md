---
title: 'Scanning process memory with regex: How I built PMPS'
date: 2024-05-19
slug: scanning-process-memory-with-regex-how-i-built-pmps
draft: false
---

A while back i got obsessed with something: no matter how well you hide sensitive data in software, the memory always tells the truth.

that thought turned into PMPS, a C library and tool for scanning a Windows process's memory space using regex patterns. you give it a process name and a pattern, it walks through virtual memory page by page (4KB at a time) and hands you back the matched block.

the whole thing runs on top of \`VirtualQueryEx\`, the Windows API that lets you query virtual memory regions of another process. no kernel-level access needed, no full memory dumps to disk, just walking pages.

:::note

PMPS searches \*virtual\* memory, not physical memory directly. it starts at base address \`0x0\` and walks to the end of the virtual address space, one page at a time.

:::

::sep

## why 4KB pages?

memory pages on Windows are typically 4KB aligned. searching at that granularity gives you natural boundaries, and in all my testing i didn't lose data to cuts at page edges. this tradeoff is baked in right now, but a future version should let you configure the search size.

:::warning

page-boundary cuts can still happen in theory. if your pattern spans two pages you might miss it. it's a known limitation and it's documented in the repo.

:::

::sep

## the interesting part: what you can find

this is where it gets real. here are three things you can actually do with this:

\*\*1. digging tokens out of discord\*\*

send a message in discord, run PMPS against \`discord.exe\` with a pattern like \`my password:\s\*\`, and watch the authorization token show up in the matched page dump. no injection, no hooks, just reading memory that was already there.

\*\*2. detecting debuggers without checking process names\*\*

most anti-debug code checks for process names or window titles. those are trivially bypassable by renaming the process. PMPS takes a different angle: IDA has strings like "IDA Freeware" sitting in its memory. pattern-match against that and you find the debugger regardless of what it's called.

\`\`\`c
pm_t\* pm = PMSearchAllForMatch("[Ii][Dd][Aa] [Ff]reeware\s\*", TRUE);
printf("App name: %s\n", pm->exeName);
// output: ida64.exe
\`\`\`

\*\*3. hunting malware at runtime\*\*

malware often obfuscates domains at rest and decrypts them at runtime. that means even if the binary looks clean, the deobfuscated string \*has\* to exist in memory at some point. patterns like \`\*.ddns.net\` catch that.

:::diagram[Memory Walk Flow]

Process Start (0x0) → VirtualQueryEx → Readable Page? → Run Regex → Match Found → Return Block

:::

::sep

## the api is simple on purpose

\`\`\`c
pm_t\* pm = CreateProcessMatcher("[Hh]ey");
GetProcessHandleByName(pm, "target.exe");
char\* block = PMFindMatchBlock(pm);
while (block != NULL) {
    printf("%s\n", block);
    block = PMFindMatchBlock(pm); // stateful, keeps walking
}
CleanupProcessMatcher(pm);
\`\`\`

the state lives in the \`pm_t\` struct. call \`PMFindMatchBlock\` again and it picks up where it left off. no restarting, no re-scanning from scratch.

:::note

the buffers \`stringBuffer\` and \`memDumpBuffer\` are fixed 4KB heap allocations. they get overwritten on every call. if you need to hold the data, copy it yourself.

:::

::sep

## what i'd do differently now

a few things i'd revisit:

- the regex engine is \`tiny-regex-c\` by kokke, which is great for embedded use but has limited syntax. a more complete engine would open up more use cases
- fixed page size is a real constraint. parameterizing the scan size is the obvious next step
- windows-only. a cross-platform version using \`/proc/<pid>/maps\` on linux would be interesting

::sep

## tldr

:::tldr

PMPS walks a Windows process's virtual memory page by page, runs a regex on each page, and returns the matching block. useful for memory forensics, anti-debug detection, and malware analysis. no kernel access required.

:::

the repo is at [GhaynOrg/PMPS](https://github.com/GhaynOrg/PMPS) if you want to poke at the code.
