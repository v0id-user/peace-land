---
title: Reconsidering how I learn software engineering
date: 2026-11-25
slug: reconsidering-how-i-learn-software-engineering
draft: false
description: I no longer feel I need to understand something in depth before building with it. Concepts, knowing what exists, and the consequences of my decisions matter more.
---

:::tldr
I no longer feel the necessity to understand something in depth before building with it. What I care increasingly more about is understanding things conceptually, knowing what exists, and understanding the consequences of the decisions I make.
:::

## Well

Earlier this year, I wrote two articles:

- [Big O and Why I Finally Stopped Ignoring It](/posts/big-o-and-why-i-finally-stopped-ignoring-it/)
- [Relearning rust in a world that codes for you](/posts/relearning-rust-in-a-world-that-codes-for-you/)

What's funny is that it didn't even take me three months to change my perspective on a lot of what I wrote.

I bought an entire course on data structures and algorithms to understand Big O notation. I wanted to deliberately restrict my usage of AI, disable autocompletion, and force myself to write Rust by hand.

There was this weird feeling of obligation. Oh, I'm going to build something in Rust? I need to go learn Rust.

Today, I fully embrace agentic coding. From implementation to reviews to optimizations, I don't feel the necessity to deliberately restrict myself anymore.

## Big O?

I bought that course, and genuinely, I don't give a fuck about it. Nothing changed in the next four months of my work.

Instead, I became one of the people bringing up time complexity in discussions at work. *Guys, this doesn't feel right, there's a nested loop here, let's think about the time complexity.*

And we think about it together. If someone knows it on the spot, great. If nobody does, we paste it into Claude, read the output together, and discuss whether what it's saying is bullshit or not.

This has become increasingly common in how I work.

Your code runs on a time complexity. You need to understand that conceptually, not deeply, or your code is fucked. There are trade-offs to your algorithms, your for loops, your while loops.

Do I need to spend hours studying different algorithms and implementing them by hand to understand this? I don't think so.

The same applies to a lot of things in software engineering.

I need to understand the consequences of how I represent my data. Why would I use a particular integer width? What happens when I pass pointers around? Do I even need to dynamically allocate memory here? Can I make the memory usage of my program more predictable?

Writing C is one of the scariest things to me because I understand the memory safety guarantees that C doesn't provide.

These are things I need to understand conceptually because they influence what I ask for, what I question, and what I consider when building something.

## Knowing what exists

Over the past few months, I've been building some fairly complex systems with agents. [Cubepals](/posts/building-cubepals/) is probably the biggest example. Minecraft servers that sleep when nobody is on and wake up when someone joins, an edge that holds the player while their server boots, Bedrock players joining Java servers, one Fly app per server, cron jobs, and a lot of parts that can fail.

I'm also currently building Pryx, where one of the things I wanted was to enforce network restrictions on processes at the kernel level using eBPF.

Do I know much about eBPF? No, I don't.

But I know it exists. I know what I want out of it, and that's why I directed my agent to look into it.

I think this is one of the most important things when working with agents. You need to know what you want to tell your agent, and a lot of that comes from what you understand conceptually and what you know is possible.

## Do I still need depth?

Yes.

Although I'm not entirely sure if I'm saying this because I genuinely believe it or because I feel obligated to say it.

That you still need to understand things deeply, that you still need to read, that there are certain things you still need to learn yourself.

I've always said that depth is a luxury, and you don't always have that luxury. Sometimes you barely have the mental energy to allocate to the things you're already doing, let alone spend hours understanding the internals of something.

I'm still an advocate for reading. I genuinely want to read *Designing Data-Intensive Applications*. I've read a little of it, and within the first ten pages I had already learned something.

But I don't feel the necessity to read it. There's a difference between me wanting to read that book and me feeling that I need to read that book.

And what do I actually want to get out of it? Do I want to understand every single thing discussed in that book in depth? Not necessarily.

Reading is still important, but not because you need to understand the depth of the depths. Let your agent do that. Your agent can extract the bullshit for you. But you need to know what you're looking for, and I think a lot of tech leads and people actually innovating in this space still point to this.

## So?

I think a lot of this was bullshit even before AI.

You want to build something in Rust, so you go on Udemy, buy a course, and start learning Rust from scratch. Why?

I hate that this mindset stuck with me for as long as it did, even in April of this year.

Get your hands on things. Build something. Get stuck on problems. There, where you have to rethink everything you know.

That's where you learn.
