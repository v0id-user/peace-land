---
title: Building Cubepals
description: 'Cubepals is a Minecraft hosting platform where servers sleep when nobody is playing and wake when someone joins. I built it entirely with Claude Code and launched it.'
date: 2026-10-20
slug: building-cubepals
draft: false
---

[Cubepals](https://cubepals.com) is a Minecraft server hosting service I built and launched. This post is about building it.

I've been building things for years, and most of them never went anywhere beyond my own computer. I would get fascinated by something, spend days or weeks understanding it, build whatever I had in mind, and move on. Sometimes I lost interest, sometimes another idea took over, and sometimes I felt I had learned what I wanted to learn. Then I started again. I kept changing what I wanted to build, but I never stopped wanting to build things.

Cubepals was different. It's a Minecraft hosting platform where servers sleep when nobody is playing and wake when someone joins. You create a server, share its address with your friends, and that's it. Nobody has to open a dashboard to turn it on before playing. It sounds simple, which is what I wanted, but it turned into one of the most sophisticated projects I've worked on.

## The infrastructure

I've always been fascinated by the machinery behind software more than the visible parts: machines starting and stopping, services talking to each other, resources being allocated and released, and something deciding what should be running, where, and when it should disappear. Cubepals gave me a reason to explore those ideas in an actual product.

A Minecraft server is a real process running on a real machine, consuming real resources. When nobody needs it, there's no reason for it to keep running, and when someone wants to play, they shouldn't have to think about the infrastructure behind it. The challenge was making all of that disappear from the player's experience. That meant a lot of thinking about the edge, the control plane, machine lifecycle, leases, storage, and the many small pieces that have to work together to make it feel effortless.

I don't claim to understand every layer of this system deeply. One of the more interesting parts of building it was how much I could explore without personally implementing every detail.

## Building without writing code

I built Cubepals entirely with Claude Code, and I didn't write the implementation by hand. I know that's a controversial way to build software, but writing code has never been the point for me. I care about what the software does, why it works, how it behaves when something goes wrong, and whether it solves the problem I set out to solve.

So instead of implementing every function, I spent my days making decisions: researching approaches, challenging assumptions, describing expected behavior, testing outcomes, reviewing failures, and deciding what needed to change. I also kept building a system around the agents themselves, made of rules, documentation, research notes, automated checks, isolated tasks, pull requests, staging, and deployment.

When something went wrong, I wanted the mistake to become a rule, and whenever possible I wanted that rule enforced by something more reliable than a model remembering it. I didn't want the agents to be clever once. I wanted the process to become more dependable every time it failed. That became a project of its own.

## Respect for the craft

I've always cared about the little things, even on the smallest personal projects: linting, testing, CI, licensing, documentation, naming, repository structure, and how someone else would feel opening the source code for the first time. I used to spend an unreasonable amount of time on these details even when nobody else was going to see them, and I still do. I think it's a form of respect for the craft. With the tools available today I could finally give them the attention I wanted without having to choose between polishing the foundation and shipping the product.

I cared about Cubepals as a complete thing, which includes the website, the branding, the onboarding, the small pieces of copy, and the way it looks and feels. I also created my own Minecraft server on the platform and made it public. I built a service that hosts servers and now I host my own server on it, and I don't know why that makes me so happy, but it does.

## Putting it out there

This is the biggest difference between Cubepals and everything I've built before: I actually launched it, and I didn't just publish a repository and leave it there. I posted in communities, explained how things worked, answered questions, took criticism, fixed problems, and kept coming back to see what people were saying. For someone who has never been very active on social media, that was a new experience.

Then something happened that made the whole project feel different. A stranger from Korea found Cubepals before I officially launched it. He signed up, created a server, and within about three minutes of reaching the website he was standing in his own Minecraft world. He played for nearly two hours. I had never met him, I didn't know how he found the website, and I hadn't asked him to try it. He arrived, used something I built, and spent part of his day enjoying it.

I kept looking at the session, not because the numbers were impressive, but because it was real. For weeks Cubepals had been a collection of decisions, services, repositories, tests, and machines, and for someone on the other side of the world it was just a Minecraft server. That was a beautiful moment.

## Next

I'm still figuring out what Cubepals will become. There are problems to fix, things to learn, decisions to reconsider, and a lot of uncertainty about whether it will turn into a real business. But for the first time I'm not building something only because I find the engineering fascinating. I'm building it for other people, and I'm staying around to see what happens.

I've started over many times, changed interests, abandoned projects, and gone in directions I couldn't have predicted, but the curiosity never left. Now, instead of moving on as soon as something works, I'm sharing it, listening to people, and continuing. I don't know where this goes, but I'm really glad I started.
