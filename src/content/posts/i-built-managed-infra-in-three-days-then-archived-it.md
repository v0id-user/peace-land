---
title: 'I built a whole managed infra in three days then archived it'
date: 2026-04-26
slug: i-built-managed-infra-in-three-days-then-archived-it
draft: false
---
 
I built a whole managed realtime infra called [hela](https://github.com/v0id-user/hela). five primitives, four sdks, two react apps, one elixir gateway, one elixir control plane, polar billing, terraform for railway, the works. i shipped 216 deployments to production. i archived it three days later.
 
The reason isn't clever. i got burned out. i didn't think much while building it. that's the post.
 
Let me back up.
 
The idea was open source ably. realtime on the beam, channels and presence and history and sequencing and auth, all of it readable, all of it under agpl, hosted regions for people who don't want to operate it themselves. i think the idea is fine. i still think the idea is fine. the problem is i didn't sit with it long enough to know what the smallest version of it looked like, and once i started building, agentic coding doesn't make you stop and ask.
 
so i built. gateway in elixir. control plane in elixir. typescript sdk. python sdk. go sdk. rust sdk. codegen pipeline so the schemas were the source of truth. marketing site with five live demos hitting a real gateway. customer dashboard. polar webhook for billing. inline svg architecture diagrams. brand assets at six sizes plus webp. tier pricing baked into the type system. the readme had a region table.
 
day three i looked at the deploy graph and saw 216 deployments. i looked at the four sdks i now had to maintain. i looked at the dashboard for a hosted product i'd never sold. i looked at the polar tier configs for a price i'd never charged. and i didn't want any of it.
 
## that's the burnout
 
it isn't dramatic. it's the moment where you realize you've been moving for three days in a direction nobody asked for, including you, and the energy you started with is gone, and what's left is the maintenance shape of the thing you built. four sdks don't maintain themselves. a hosted product doesn't sell itself. a marketing site doesn't drive itself. you signed up for all of it the moment you typed it into existence.
 
so i archived it.
 
if i wanted to dress this up as a post-mortem i could give you headings. scope creep. spec-first development. mvp definition. those are real and i probably learned them somewhere in there. but the actual thing that happened is simpler and i don't want to launder it through frameworks. i had energy. i pointed it at an idea i hadn't sat with long enough. i used a coding loop fast enough to outrun my ability to steer.
 
agentic coding is real. you can ship in three days what would have taken a team three months. that part isn't hype. the part nobody warns you about is that the loop doesn't push back. if your idea is half-baked, the loop will bake it into eight files. if you don't know what you're building, the loop will build the shape of every plausible version of it. the speed is real. the steering is yours. and if you don't have a spec, the steering is whatever feels like progress in the next twenty minutes.
 
i didn't have a spec. i had a vibe. the vibe carried me 216 deployments deep before it ran out.
 
i'm leaving the repo up. archived, not deleted. the architecture notes, the codegen pipeline, the brand assets, the inline svg diagrams, those parts came out fine. someone curious about how you'd structure a beam realtime platform on railway with four sdks can land on the readme and pull what they want. the part that didn't come out fine is the part this post is about.
 
next thing i build, i'll know what's out of scope before i know what's in. i'll write a spec before i open a loop. i'll keep one repo per surface until something earns being merged. i won't add a second sdk language until the first one stops bleeding. and i won't confuse the energy of starting with the clarity of knowing what i'm starting.
 
next thing is smaller. on purpose.
 