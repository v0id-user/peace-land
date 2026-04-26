---
title: 'I built a whole managed infra in three days then archived it'
date: 2026-04-26
slug: i-built-managed-infra-in-three-days-then-archived-it
draft: false
---
 
## What?

I built a whole managed realtime infra called [hela](https://github.com/v0id-user/hela). Five primitives, four SDKs, two React apps, one Elixir gateway, one Elixir control plane, Polar billing, Terraform for Railway, the works. I shipped 216 deployments to production. I archived it three days later.
 
The reason isn't clever. I got burned out. I didn't think much while building it. That's the post.
 
Let me back up.
 
The idea was open source Ably. Realtime on the Beam, channels and presence and history and sequencing and auth, all of it readable, all of it under AGPL, hosted regions for people who don't want to operate it themselves. I think the idea is fine. I still think the idea is fine. The problem is I didn't sit with it long enough to know what the smallest version of it looked like, and once I started building, agentic coding doesn't make you stop and ask.
 
So I built. Gateway in Elixir. Control plane in Elixir. TypeScript SDK. Python SDK. Go SDK. Rust SDK. Codegen pipeline so the schemas were the source of truth. Marketing site with five live demos hitting a real gateway. Customer dashboard. Polar webhook for billing. Inline SVG architecture diagrams. Brand assets at six sizes plus WebP. Tier pricing baked into the type system. The README had a region table.
 
Day three I looked at the deploy graph and saw 216 deployments. I looked at the four SDKs I now had to maintain. I looked at the dashboard for a hosted product I'd never sold. I looked at the Polar tier configs for a price I'd never charged. And I didn't want any of it.
 
## That's the burnout
 
It isn't dramatic. It's the moment where you realize you've been moving for three days in a direction nobody asked for, including you, and the energy you started with is gone, and what's left is the maintenance shape of the thing you built. Four SDKs don't maintain themselves. A hosted product doesn't sell itself. A marketing site doesn't drive itself. You signed up for all of it the moment you typed it into existence.
 
So I archived it.
 
If I wanted to dress this up as a post-mortem I could give you headings. Scope creep. Spec-first development. MVP definition. Those are real and I probably learned them somewhere in there. But the actual thing that happened is simpler and I don't want to launder it through frameworks. I had energy. I pointed it at an idea I hadn't sat with long enough. I used a coding loop fast enough to outrun my ability to steer.
 
Agentic coding is real. You can ship in three days what would have taken a team three months. That part isn't hype. The part nobody warns you about is that the loop doesn't push back. If your idea is half-baked, the loop will bake it into eight files. If you don't know what you're building, the loop will build the shape of every plausible version of it. The speed is real. The steering is yours. And if you don't have a spec, the steering is whatever feels like progress in the next twenty minutes.
 
I didn't have a spec. I had a vibe. The vibe carried me 216 deployments deep before it ran out.
 
I'm leaving the repo up. Archived, not deleted. The architecture notes, the codegen pipeline, the brand assets, the inline SVG diagrams, those parts came out fine. Someone curious about how you'd structure a Beam realtime platform on Railway with four SDKs can land on the README and pull what they want. The part that didn't come out fine is the part this post is about.
 
Next thing I build, I'll know what's out of scope before I know what's in. I'll write a spec before I open a loop. I'll keep one repo per surface until something earns being merged. I won't add a second SDK language until the first one stops bleeding. And I won't confuse the energy of starting with the clarity of knowing what I'm starting.
 
Next thing is smaller. On purpose.
 