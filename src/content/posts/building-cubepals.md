---
title: Building Cubepals
description: 'Cubepals is a Minecraft hosting platform where servers sleep when nobody is playing and wake when someone joins. I built it entirely with Claude Code and launched it.'
date: 2026-10-20
slug: building-cubepals
draft: false
---

I've been building things for years. Most of them never went anywhere beyond my own computer.

I would get fascinated by something, spend days or weeks understanding it, build whatever I had in mind, and eventually move on to something else. Sometimes I'd lose interest. Sometimes another idea would take over. Sometimes I'd simply feel like I'd learned what I wanted to learn.

And then I'd start again.

I've done this for as long as I can remember. Different projects, different technologies, different interests. I kept changing what I wanted to do, but I never really stopped wanting to build things.

Cubepals was different.

It's a Minecraft hosting platform where servers sleep when nobody is playing and wake when someone joins. You create a server, share its address with your friends, and that's pretty much it. Nobody has to open a dashboard to turn it on before playing.

It sounds simple, and that's exactly what I wanted.

But building it turned into one of the most sophisticated projects I've ever worked on.

## The things I love building

I've always been fascinated by infrastructure. Not necessarily the visible parts of software, but the machinery behind it.

Machines starting and stopping. Services talking to each other. Resources being allocated and released. Something somewhere deciding what should be running, where it should run, and when it should disappear.

There's something incredibly satisfying about controlling all of that.

Cubepals gave me a reason to explore those ideas in an actual product.

A Minecraft server is a real process, running on a real machine, consuming real resources. When nobody needs it, why should it keep running? And when someone wants to play, why should they have to think about the infrastructure behind it?

The challenge became making all of that disappear from the player's experience.

I spent a lot of time thinking about the edge, the control plane, machine lifecycle, leases, storage, and the dozens of little things that have to work together to make something feel effortless.

I don't claim to understand every layer of this system deeply. In fact, one of the most interesting things about building it was how much I could explore without having to personally implement every detail.

## Building without writing code

I built Cubepals entirely with Claude Code.

I didn't write the implementation by hand.

I know that's a controversial way to build software, but to me, writing code has never been the point of building software. I care about what the software does, why it works, how it behaves when something goes wrong, and whether it solves the problem I wanted to solve.

The tools have changed how I approach that.

Instead of spending my days implementing every function, I spent them making decisions. Researching approaches, challenging assumptions, describing expected behavior, testing outcomes, reviewing failures, and deciding what needed to change.

And I kept building a system around the agents themselves.

Rules, documentation, research notes, automated checks, isolated tasks, pull requests, staging, deployment.

When something went wrong, I wanted that mistake to become a rule, and whenever possible, I wanted that rule enforced by something more reliable than a model remembering it.

I didn't want the agents to be clever once. I wanted the process to become more dependable every time it failed.

That became a project of its own.

## Respect for the craft

There's something about building software that I've always cared about, even when I was working on the smallest personal projects.

The little things.

Linting. Testing. CI. Licensing. Documentation. Naming. Repository structure. How someone else would understand the project. How it would feel to open the source code for the first time.

I used to spend an unreasonable amount of time on these details, even when nobody else was going to see them.

I still do.

I think it's a form of respect for the craft.

And with the tools available today, I could finally give those details the attention I wanted without having to choose between polishing the foundation and actually shipping the product.

I cared about Cubepals as a complete thing.

Not only the infrastructure, but the website, the branding, the onboarding, the small pieces of copy, the way it looks and feels.

I even created my own Minecraft server on the platform and made it publicly available.

There's something funny and wonderful about that to me.

I built a service that hosts servers, and now I'm hosting my own server on the service I built.

I don't know why that makes me so happy, but it does.

## Putting it out there

This is probably the biggest difference between Cubepals and everything I've built before.

I actually launched it.

And I didn't just publish a repository and leave it there.

I went out and told people about it.

I posted in communities. I explained how things worked. I answered questions. I took criticism. I fixed problems. I kept coming back to see what people were saying.

For someone who has never been particularly active on social media, that was a new experience.

And then something happened that made the entire project feel different.

A stranger from Korea found Cubepals before I officially launched it.

He signed up, created a server, and within about three minutes of reaching the website, he was standing in his own Minecraft world.

He played for nearly two hours.

I had never met this person. I didn't know how he found the website. I didn't ask him to try it.

He just arrived, used something I'd built, and spent part of his day enjoying it.

I kept looking at the session.

Not because the numbers were particularly impressive, but because it was real.

For weeks, Cubepals had been a project. A collection of decisions, services, repositories, tests, and machines.

And suddenly, for someone on the other side of the world, it was just a Minecraft server.

That was a beautiful moment.

## A new chapter

I'm still figuring out what Cubepals will become.

There are problems to fix, things to learn, decisions to reconsider, and plenty of uncertainty about whether it will turn into a real business.

But for the first time, I'm not just building something because I find the engineering fascinating.

I'm building something for other people, and I'm staying around to see what happens next.

I think that's what makes this project special to me.

I've started over so many times. I've changed interests, abandoned projects, explored new technologies, and gone in directions I couldn't have predicted.

But the curiosity never really left.

And now, instead of moving on as soon as something works, I'm trying something different.

I'm sharing it.

I'm listening.

I'm continuing.

I don't know where this goes.

But I'm really glad I started.
