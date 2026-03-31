---
title: "Uncompressible File. A File That Defies Compression Algorithms."
date: 2026-02-01
slug: uncompressible-file-a-file-that-defies-compression-algorithms
description: What happens when you try to compress truly random data? An experiment exploring the limits of compression algorithms.
---

I got the idea for this experiment from an episode titled [*“Searching For Meaning In Randomness”*](https://www.youtube.com/watch?v=tiXIOpq_tQ0) from the podcast **The Rest Is Science**. It inspired me to ask: **what happens when we try to compress truly random data?**

Let’s start with a simple analogy:

* If you roll a die six times and get the same number every time:  
  `6, 6, 6, 6, 6, 6`  
  This is **easy to describe and compress**. You could summarize it as: *“I rolled a die six times, and it landed on 6 each time.”*
* But if the rolls are completely random:  
  `3, 1, 5, 2, 6, 4`  
  There’s no pattern. Each value is independent, and you can’t summarize the sequence without losing information.

That’s exactly what I wanted to test with compression algorithms.

I generated a **1 MB file** filled with **truly random bytes** using a high-entropy generator, then tried compressing it using popular algorithms:  
`gzip`, `xz`, `zstd`, and `brotli`.

The results were as follows:

```
Generating high-entropy file...
Size: 1.00 MB (1,048,576 bytes)
Output: output.bin
```

`Successfully generated 1,048,576 bytes of high-entropy data`  
  
`Output file: output.bin`

`Compression comparison (entropy vs lossless at max level):`  
  
`Original size: 1,048,576 bytes (1.00 MB)`

`gzip 1,048,925 bytes ratio 1.0003 -> output.bin.gz`  
  
`xz 1,048,688 bytes ratio 1.0001 -> output.bin.xz`  
  
`zstd 1,048,613 bytes ratio 1.0000 -> output.bin.zst`  
  
`brotli 1,048,584 bytes ratio 1.0000 -> output.bin.br`

`Entropy wins: best compressed size >= original (compression useless)`

As expected, **the file size did not decrease**. In some cases, it even increased slightly due to metadata overhead.

This demonstrates a fundamental idea in data compression:

**Compression relies on patterns.**  
  
If the data has **maximum entropy**, there’s no pattern to exploit, and lossless compression cannot reduce its size.

In simpler terms:

* **Repeated or predictable data → compressible**
* **Completely random data → uncompressible**

The concept may seem obvious in theory, but seeing powerful compression algorithms fail **in practice** against a fully random file makes it much clearer.

---

Source code:  
  
[https://github.com/v0id-user/uncomp](https://github.com/v0id-user/uncomp?tab=readme-ov-file)

*This English version of the article was translated with the help of AI. Because the original post was written in Arabic, some nuances or details may not have transferred perfectly in the translation. For the most accurate version, you may prefer reading the original Arabic article.*