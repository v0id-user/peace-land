---
title: 'A Recursive DNS Resolver in Rust: RFC 1035, Bytes and Nothing Else'
date: 2026-03-31
slug: a-recursive-dns-resolver-in-rust-rfc-1035-bytes-and-nothing-else
draft: true
description: Building a recursive DNS resolver from scratch in Rust by implementing RFC 1035 byte by byte — no libraries, just the spec.
---

We've all read RFCs. but have you actually sat with one, section by section, and understood the intent of the writer?

Here's the thing. it's not written to teach you. the writer isn't trying to explain concepts or hold your hand through the ideas. the only purpose of an RFC is exactly what you do at work: write precisely enough that two separate implementers can build the exact same system and communicate with each other from opposite ends of the world. that's it.

So that's what this post is. no summaries, no "here's the general idea", no high-level overviews. just a section-by-section disciplined recreational session following RFC 1035 to implement a recursive DNS resolver, as intended.

There will be shortcuts ofc, but the original implementation stands. The RFC: [RFC 1035](https://datatracker.ietf.org/doc/html/rfc1035). The language of choice will be Rust. you know, spice up the session and correctness. 😆
