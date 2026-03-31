---
title: 'From int to u32: How Rust Changed My Perspective on Low-Level'
date: 2025-06-04
slug: from-int-to-u32-how-rust-changed-my-perspective-on-low-level
description: How switching from high-level languages to Rust changed the way I think about types, memory, and low-level programming.
---

Before

Not long ago, I started working on a real-time chat project built entirely from scratch using modern technologies: Rust, WebAssembly, and Cloudflare Workers. I teased it on Twitter, but in the middle of all that, there was one point I really wanted to dive deep into — my choice of Rust.

The Turning Point: Why Rust Changed My View on Low-Level

My choice of Rust for the new project is a complete shift in my perspective on Low-Level. I wanted to talk about this topic and why I didn't choose C — and I'm a C fan boy — but I won't just give you the basics like "Rust is a safe language." I'll help you understand exactly why it's safe and what that actually means.

I'm sure by now you all know Rust is a safe language, but if I asked most of you: what are the safety criteria in this language? Most would say the borrow checker — and that is indeed a core factor — but there are other factors too, and I'll speak from my own experience.

No Integer? Why Is Rust Strict Even With Numbers?

Rust won't let you make mistakes and cause chaos even when you don't fully understand what you're doing. You may have noticed that Rust has no Integer? Rust truly has no concept of "numbers"! It has bytes with sizes — i32, i64, u32, u64, isize, usize. The letter "i" means signed and "u" means unsigned. But why?

Let me give you an example. Everything you see on your device — a file, a protocol, anything binary — is at its core a struct. Let's say a simple protocol made of content and a length field.

If I asked you to model this protocol in C? Chances are, if it's your first time dealing with these things, you'd make this mistake:

If you've been working with C for a while, you'd catch the problem immediately — which is that "int" has no fixed identity, or what's called a "ranked integer type." These numbers have no fixed width or size; it depends on the compiler, the OS, or the architecture you're on — either 4 bytes or 8 bytes, with no fixed rule.

This is either a bug or a feature depending on how you see it in C, because it's a very flexible bare-bones language and the specs can be changed based on your needs and perspective. Unfortunately, if you're coming from a high-level language straight to C, this will confuse you — because nobody explains exactly what it is when you're just starting out.

stdint.h: The Official C99 Solution to Save You from Integer Chaos

The solution? "stdint.h" — introduced with C99 by ISO and later adopted into POSIX. What problem does it solve? "declare sets of integer types having specified widths."

Whether on Windows, Mac, or Linux, if you want bytes of a fixed size, your best solution is to use stdint.h. You can't do it yourself, because the number is fixed or set — like 4 or 8 — directly by the compiler. The "unsigned int", "int", "signed int" are again "ranked integer types."

So how do you model the protocol above in a (relatively) safe way?

You'll also notice I replaced "char" with "uint8_t", which actually means "unsigned char." This is a standard that lets you work with bytes in a clear and consistent way — instead of ranging from -127 to 127, it goes from 0 to 255, exactly as protocols and files expect.

Think it's over? Of course not. Now think: you're building a protocol and want to send it over a network. You need to deal with a new concept — little endian and big endian — with helper functions like ntoh, hton, and others, plus how to serialize and deserialize, and so on.

How Rust Removes All That Headache

Did you notice the complexity we fell into above? By default in Rust, you can avoid all of it easily. The types you needed an entire library for are simply built into the language itself. Let's model the protocol in Rust and come back to the main point that Rust would have saved you from this problem by default.

As you can see, I used u32 for the length and Vec for the data — all safe types by default. No guessing, no "maybe," no compiler deciding for you. Why? Because that's the standard in Rust. The language teaches you from the start that everything has a clear meaning, and every choice must be explicit and intentional.

You might say: "But some people might make mistakes and use usize for length, for example." My response: even then, Rust has a stronger ecosystem. Example? If you look at the derive I used — bincode — it guarantees that the data cannot be decoded unless the type matches 100%. So even if you mess up a field type, Rust won't allow deserialization. That's the deeper meaning of safety: a strict language that understands Low-Level and makes you write correctly from the first try, even if you didn't intend to.

A Deeper Look at bincode from Rust

After understanding how Rust saves you from the disasters C can throw you into, let me show you how even its tools are designed with the same strict and clear philosophy.

Take the library I used earlier: bincode. It doesn't do serialization in the traditional sense — it does binary encoding, without overhead, without metadata, without fluff. What does that mean? It means you focus on the shape of the protocol itself, not how to transfer it, not how to do endian conversion, not how to define bytes. All those questions become "not your problem," because the library literally tells you: "You just define the struct, and we'll handle the rest."

Even if you get the field type wrong — say you used usize by mistake — bincode won't allow decoding at all. The safety here isn't just from the language; safety comes from every layer around it. The result? All your thinking goes into delivering value, or in other words, the shape of the message — not "how do I make sure it arrived correctly?"

A New View on Low-Level

I used to think that Low-Level meant I had to have full control, and that nobody could give me a hand or help me or make things easier. Everything had to be written from scratch, every mistake had to be learned the hard way. But honestly? That was Ego more than principle. 😂 Accepting help doesn't mean you cheated — in fact, I'd argue that if you accept it, you made the smarter choice.

Conclusion

Rust didn't just give me tools — it gave me a way of thinking. A language that pulls you out of the "I don't know if it works" spiral and puts you into a system where everything is calculated, clear, and guaranteed.

C? It was teaching me to be clever by force just so I wouldn't make mistakes.

Rust? It writes code that doesn't make mistakes even if I'm not paying full attention.

And of course, this isn't the end — there are still many more benefits I've found from using Rust that I'll cover in future posts.

_This English version of the article was translated with the help of AI. Because the original post was written in Arabic, some nuances and details may not have carried over perfectly into the translation. For the most accurate version, you may prefer reading the original Arabic post._
