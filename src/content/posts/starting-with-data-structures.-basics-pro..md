---
title: Big O and Why I Finally Stopped Ignoring It
date: 2026-03-29
slug: big-o-and-why-i-finally-stopped-ignoring-it
---

I landed and held a job at a respected company without a CS degree, purely on raw experience. I'm proud of that. But there's always been this nagging cultural gap, the kind that shows up in code reviews, system design conversations, or just reading other engineers' reasoning. Algorithm complexity was one of those gaps.

It's not that it comes up constantly. It's that when it does, not knowing it is embarrassing. And on the rare occasion you're actually optimizing a hot path (think Cloudflare-scale problems), it genuinely matters. That was enough motivation to pick up a Udemy course on [Data Structures and Algorithms in Python](https://www.udemy.com/course/data-structures-algorithms-python/) and start documenting what I learn.

This is that documentation.

***

## The Three Complexity Notations

Before diving in: Big O isn't the only notation. There are actually three:

- **Big O (O)**: worst case. How bad can it get?
- **Omega (Ω)**: best case. The happy path.
- **Theta (Θ)**: average case. The realistic middle ground.

In practice, engineers almost exclusively talk about Big O because you design systems for the worst case, not the best one. The "n" in all of these notations refers to the size of the input passed into a function. As `n` grows, how does the operation time grow?

We primarily care about **time complexity** (how long it takes) over **space complexity** (how much memory it uses), but space is worth keeping in the back of your head, especially when you're caching aggressively or working with large data.

***

## O(1): Constant Time

No matter how large the input is, the operation takes the same amount of time. The input size is irrelevant.

```plain
def add_items(n):
    return n + n + n
```

Calling this with `n = 10` or `n = 10,000,000` takes the same time. That's the dream. Flat line on a graph. You want this wherever possible.

***

## O(n): Linear Time

The operation scales directly with the input. Double the input, double the time. A single loop is the classic example:

```plain
def print_items(n: int):
    for i in range(n):
        print(i)
```

This is a straight diagonal line on a graph. Totally acceptable in most cases. It's honest, predictable, and easy to reason about.

***

## O(n²): Quadratic Time

A nested loop. For every element in `n`, you iterate over `n` again.

```plain
def print_items(n: int):
    for i in range(n):
        for j in range(n):
            print(i, j)
```

**Fact-check note:** This is called _quadratic_ complexity, not exponential. Easy mistake to make. Exponential would be O(2ⁿ), which is a completely different (and much scarier) beast where the time doubles with every single added element. Quadratic means the time grows with the _square_ of the input. Still bad, just not apocalyptically bad.

As input grows, the performance cliff is steep. At `n = 1000`, you're doing a million operations. This is something you want to refactor away from if the input can get large.

***

## Multiple Inputs: O(a + b)

When a function takes multiple inputs, you track them separately. They don't automatically collapse into a single `n`.

```plain
def print_items(a: int, b: int):
    for i in range(a):
        print(i)

    for i in range(b):
        print(i)
```

This isn't O(n) or O(2n) (which simplifies to O(n) anyway). It's **O(a + b)** because `a` and `b` are independent variables. If those were nested loops instead of sequential ones, it would be O(a × b). The distinction matters when inputs can grow at different rates.

***

## Why Bother?

Honestly, most of the time you won't be hand-tuning complexity in day-to-day product work. But knowing this vocabulary changes how you _think_ about code. You start noticing when a loop is hiding inside another loop. You understand why someone says "that'll be slow at scale." You can participate in the conversation without nodding along pretending.

And if you ever do work at a scale where milliseconds matter? You'll be glad you know this.

More notes coming as I work through the course.
