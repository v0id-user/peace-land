---
title: 'WebTransport: A New Way to Connect Things in Real Time'
date: 2026-08-26
slug: webtransport-a-new-way-to-connect-things
description: First impressions from a weekend spent building a WebTransport server in Go and a client in React — streams, datagrams, and choosing reliability per message.
---

:::tldr
WebTransport is HTTP/3, so QUIC, so UDP. One connection gives you many independent streams (reliable, ordered, non-blocking each other) plus one flat datagram lane (unreliable, unordered, message-bounded). Streams hand you bytes, so you write your own framing. Datagrams hand you whole messages capped at the path MTU. The API is small enough to read in an afternoon, and it puts per-message reliability within reach without dragging WebRTC along. Code at [v0id-user/webtransport](https://github.com/v0id-user/webtransport).
:::

***

:::note
These are first impressions. I spent a weekend building a small WebTransport server in Go and a client in React, and this is what stood out while it was still fresh.
:::

The short version: WebTransport is an enabler. It doesn't teach you anything new about networking. It takes things you already know and puts them within reach, with an API small enough that you'll actually use them.

::sep

## The problem it solves

WebSockets give you one TCP connection. Everything goes through it. A lost packet means everything behind it waits for the retransmit before anything continues.

That's head-of-line blocking. For a chat app you'll never notice. For cursor positions at 60Hz you will, and the failure is worse than it looks: the retransmitted packet arrives late carrying a position that's already stale, and it delayed three fresher ones to get there.

The existing fix was a WebRTC data channel. It works. It also means signalling, SDP, ICE, and a peer connection, all so you can talk to your own server. People did it. Game engines did it for years. Nobody enjoyed it.

WebTransport is HTTP/3, so QUIC, so UDP. You get:

- **Multiple independent streams** on one connection, each reliable and ordered, none blocking the others.
- **Datagrams**: genuinely unreliable, unordered delivery.
- **One connection**, one handshake, one congestion controller.

:::warning
Chrome and Edge for now. Safari isn't there. Build the fun demo, don't plan a migration around it yet.
:::

::sep

## Lanes

One session, several lanes, all on one connection:

```plain
        ONE SESSION (one QUIC connection)
   ┌──────────────────────────────────┐
   │ bidi stream    ← RPC / requests  │
   │ bidi stream    ← file upload     │
   │ uni  stream    → server events   │
   │ datagrams      ↔ one flat lane   │
   └──────────────────────────────────┘
```

Two things about this that are easy to misread.

**Streams are not topics.** No name, no path, no address. You can't connect *to* a stream. `createBidirectionalStream()` is closer to `malloc()` than to `connect()`. There's no handshake and no round trip, because a QUIC stream ID is just an increasing integer and the server first hears about the stream when your bytes arrive. Opening one costs microseconds and zero packets.

So the unit for a stream is a task, not a subject. An upload. A query. One request and its response. Something that ends.

**There's exactly one datagram lane.** Not one per stream. One per session, flat, no sub-structure at all. That's the weirdest part of the API and also the most honest one: it's flat because UDP is flat. Want channels on it? Put them in the payload yourself. Nothing is hidden from you because there's nothing left to hide.

::sep

## The smallest thing that works

Echo server, using `quic-go/webtransport-go`:

::codelabel[session.go]

```go
func handleSession(sess *webtransport.Session) {
	defer sess.CloseWithError(0, "")
	ctx := sess.Context()

	for {
		stream, err := sess.AcceptStream(ctx)
		if err != nil {
			return
		}
		go func() {
			defer stream.Close()
			io.Copy(stream, stream) // dst, src: same object
		}()
	}
}
```

Browser side:

::codelabel[client/src/App.tsx]

```typescript
const wt = new WebTransport("https://localhost:4433/")
await wt.ready

const stream = await wt.createBidirectionalStream()
const writer = stream.writable.getWriter()
await writer.write(encoder.encode("hello"))
await writer.close()          // this is a message, not cleanup

const reply = await readAll(stream.readable)
```

That `close()` is doing real work. It's not tidying up. It's how the server knows the request ended: no length prefix, no sentinel, just EOF. And `readAll` returning is how the client knows the response ended.

:::diagram[One Stream, One Request]

open stream → write bytes → close writer (EOF) → server replies → read to EOF

:::

The stream's lifecycle is the framing. That's the argument for one stream per request. QUIC already implemented delimitation and independent failure, so you spend a stream instead of writing correlation IDs and a pending-request map.

::sep

## Where the echo lies to you

It works on the first try, which is exactly why it's a bad teacher. Open two browser windows and they can't see each other:

```plain
 WINDOW A                  WINDOW B
    │                          │
┌────────────┐         ┌────────────┐
│goroutine 1 │         │goroutine 2 │
│io.Copy(s,s)│         │io.Copy(s,s)│
│     ↺      │         │     ↺      │
└────────────┘         └────────────┘

    ✗ no shared state, no path between them
```

Nothing to do with WebTransport. There's no variable in that program two sessions can both see, and `io.Copy(stream, stream)` is a mirror. Bytes leave through the exact stream they came in on. Two isolated windows is the correct behavior of an echo server.

What's missing is a hub: one shared `map[string]map[*Peer]struct{}` created at startup, handed to every session, guarded by a mutex, with the peer list copied out **before** any I/O so one slow client can't block everyone else's joins.

Which is the encouraging part. That's the same structure a WebSocket app needs. The transport changed, the room logic didn't.

:::note
Full version at [v0id-user/webtransport](https://github.com/v0id-user/webtransport): hub, peers, presence, room authorization, both lanes wired up.
:::

::sep

## Streams give you bytes, not messages

Once you have a long-lived stream pushing events to the client, the EOF trick is gone. The stream never closes. So you frame it yourself:

```plain
you write:  [len][json][len][json][len][json]...
you read:   accumulate, peek 4, wait for len more
```

Server:

::codelabel[peer.go]

```go
var hdr [4]byte
binary.BigEndian.PutUint32(hdr[:], uint32(len(msg)))
p.evt.Write(hdr[:])
p.evt.Write(msg)
```

Client:

::codelabel[client/src/App.tsx]

```typescript
if (buf.length < 4) break
const len = new DataView(buf.buffer, buf.byteOffset, 4).getUint32(0)
if (buf.length < 4 + len) break
onFrame(buf.subarray(4, 4 + len))
buf = buf.subarray(4 + len)
```

Nothing in QUIC or the browser knows about those four bytes. It's a private agreement between two functions I wrote. Eight bytes works. Two works. A varint works. Newlines work. The only rule is that both sides agree, forever.

This is what a WebSocket frame header is, except someone else wrote it and you never saw it. Every `ws.send()` you've called put a length on the wire for you. WebTransport hands you the byte pipe and lets you decide, and the price is about twenty lines of buffer accumulation on the client, because chunks don't line up with messages. One read can give you half a frame or three of them.

::sep

## Datagrams are bounded by the packet

The other lane needs none of that:

```plain
  write(A)  write(B)  write(C)
     │         │         │
   ┌───┐     ┌───┐     ┌───┐
   │ A │     │ B │     │ C │   ← 3 UDP packets
   └───┘     └───┘     └───┘
     │         │         │
   read()    read()    read()   ← 3 reads, exact
             (or C is lost, fine)
```

One write, one packet, one read. Nothing coalesces, nothing splits, because a packet is indivisible on the wire. Message boundaries for free. You pay for them:

- **~1200 bytes**, path MTU minus overhead. Read `maxDatagramSize` at send time, not at connect. It can shrink mid-session.
- **No fragmentation, ever.** RFC 9221 forbids it. Too big is a hard failure, not a slow path.

::sep

## Where the distinction stops being trivia

Everyone can recite that TCP is reliable and ordered and UDP isn't. It's a textbook line. WebTransport makes you choose between them per message, and a textbook line you have to act on becomes a real decision.

So it's worth being precise, because the sloppy version of this is everywhere. UDP being "unreliable" does not mean packets show up mangled or half-written:

```plain
UDP gives you:
  ✓ message boundaries   ← intact or absent
  ✓ integrity            ← checksummed; corrupt is discarded
  ✗ delivery
  ✗ ordering             ← A, B, C may arrive A, C, B
  ✗ deduplication        ← can arrive twice
```

A datagram arrives whole or not at all. Unreliable *delivery* and unreliable *contents* are different things. There's no half-message to defend against. There's a message that might not show up, and might show up after the one you sent behind it.

Which turns the two lanes into two halves of one problem:

```plain
streams                  datagrams
─────────────────        ───────────────────
bytes, no boundaries     whole messages
all of them              some of them
in order                 in any order
you add framing          you add sequence numbers
```

Neither is complete. You pick which half you'd rather implement.

::sep

## Unreliable is a feature

Back to the 60Hz cursor. A packet is lost. TCP's answer, and therefore a WebSocket's, is to retransmit it and hold every newer position behind it until it lands.

:::diagram[The Cost of Retransmitting a Cursor]

position lost → retransmit → 3 fresher positions wait → stale position arrives late

:::

You get a stale position, delivered late, having delayed fresher ones. Dropping it isn't a degraded outcome. It's the right one. The next update is already on its way and it's better than the one you lost.

Unreliable isn't a weaker version of reliable. It's correct whenever data expires faster than a retransmit round trip. Chat messages want a stream. Cursor positions want a datagram. Having both on one connection, and being made to choose per message, is the actual pitch for WebTransport. Not "WebSockets but newer."

::sep

## First impressions, then

The API is small. Two lanes, a few methods, no signalling, no session description, no ICE candidates. You can read the whole surface in an afternoon.

What you get for that is a transport layer you can actually reach. Choosing reliability per message used to mean adopting WebRTC and everything attached to it. Now it's a different method call on an object you already have. The concepts didn't change. The cost of using them did, and that's the whole point.

Code at [v0id-user/webtransport](https://github.com/v0id-user/webtransport).
