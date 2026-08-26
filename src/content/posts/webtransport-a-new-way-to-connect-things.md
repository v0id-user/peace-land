---
title: 'WebTransport: A New Way to Connect Things in Real Time'
date: 2026-08-26
slug: webtransport-a-new-way-to-connect-things
description: Notes from building a small WebTransport server in Go and a client in React, covering how streams and datagrams work and when to use each one.
---

:::tldr
WebTransport runs over HTTP/3, which runs over QUIC, which runs over UDP. One connection gives you two things: as many independent streams as you want, each reliable and ordered, and a single lane of unreliable datagrams. Streams deliver bytes, so you add your own message framing. Datagrams deliver whole messages, but each one has to fit in a single packet. The useful part is choosing reliable or unreliable per message without setting up WebRTC to do it. I built a small example server and client while learning it: [v0id-user/webtransport](https://github.com/v0id-user/webtransport).
:::

***

:::note
These are notes from a weekend spent building a WebTransport server in Go and a client in React. They're first impressions, not a reference.
:::

WebTransport doesn't introduce new networking ideas. Streams, datagrams, ordering and reliability all existed already. What it changes is how much work it takes to use them from a browser.

::sep

## The problem it solves

A WebSocket runs over a single TCP connection, and everything you send shares that connection. If one packet is lost, TCP holds back every byte that arrives after it until the missing packet has been retransmitted. That's head-of-line blocking.

For a chat application it doesn't matter. For cursor positions sent 60 times a second it does. The retransmitted packet does arrive, but the position it carries is out of date by then, and several newer positions were held up waiting for it.

Before WebTransport, the way around this in a browser was a WebRTC data channel. It works, but WebRTC is designed for peer-to-peer connections, so you end up dealing with signalling, SDP, and ICE just to talk to your own server.

WebTransport is HTTP/3, so QUIC, so UDP. It gives you:

- **Multiple independent streams** on one connection. Each is reliable and ordered, and a loss on one doesn't stall the others.
- **Datagrams**, which are unreliable and unordered.
- **One connection** underneath all of it: one handshake, one congestion controller.

:::note
Browser support is no longer the blocker it was. Chrome and Edge have had WebTransport since 2022 and Firefox since version 114. Safari added it in 26.4, released in March 2026, which is when WebTransport became Baseline. Users on older Safari versions still won't have it.
:::

::sep

## What a session contains

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

Two things here are easy to misread.

**Streams are not topics.** A stream has no name, path, or address, so you can't connect to a specific one the way you'd subscribe to a topic. `createBidirectionalStream()` allocates a stream locally. There's no handshake and no round trip: a QUIC stream ID is just a counter, and the server first learns the stream exists when its first bytes arrive. Opening one costs microseconds and no extra packets.

That makes a stream the right unit for a single piece of work: one upload, one query, one request and its response. Something that ends.

**There is only one datagram lane.** Not one per stream: one per session, with no sub-structure. That matches UDP, which has no notion of channels either. If you want several kinds of message on the datagram lane, put a type field in the payload and sort them out yourself.

::sep

## The smallest working example

An echo server, using `quic-go/webtransport-go`:

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

The browser side:

::codelabel[client/src/App.tsx]

```typescript
const wt = new WebTransport("https://localhost:4433/")
await wt.ready

const stream = await wt.createBidirectionalStream()
const writer = stream.writable.getWriter()
await writer.write(encoder.encode("hello"))
await writer.close()          // marks the end of the request

const reply = await readAll(stream.readable)
```

That `close()` isn't only cleanup. It's how the server learns the request is finished: there's no length prefix and no sentinel value, just the end of the stream. On the client side, `readAll` returning is how you know the response is finished.

:::diagram[One Stream, One Request]

open stream → write bytes → close writer (EOF) → server replies → read to EOF

:::

So the stream itself marks where the message starts and stops. That's the argument for using one stream per request: QUIC already gives you both the boundaries (open and close) and independent failure (an error on one stream doesn't affect the others). Over a single WebSocket you'd have to build the same thing yourself, attaching an ID to every request and keeping a map of the ones still waiting for a reply.

::sep

## Going from one client to many

The echo server above handles each session on its own, which is all an echo server needs to do. If you open two browser windows against it, they won't see each other's messages:

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

`io.Copy(stream, stream)` copies a stream into itself, so bytes go back out the same stream they came in on, and the two sessions share no state. That's the expected behaviour, and it has nothing to do with WebTransport.

To make it multi-user, say a chat room or a shared cursor layer, you add the piece the echo server doesn't have: a hub, created once at startup and shared by every session.

::codelabel[hub.go]

```go
type Hub struct {
	mu    sync.RWMutex
	rooms map[string]map[*Peer]struct{}
}
```

Each session registers its peer when it joins a room and removes it on disconnect. To broadcast, take the read lock, check that the sender is actually a member of the room it named, copy the member list into a slice, release the lock, and only then write to the peers.

Copying before writing is the part worth getting right. Writing to a peer means writing to a QUIC stream, which can block on flow control, and if you hold the hub lock while that happens, one stalled client freezes every join, leave, and broadcast in the process.

None of this is WebTransport-specific. It's the same structure a WebSocket server needs. The transport changed; the room logic didn't.

:::note
The full example, with hub, peers, presence, room membership checks and both lanes wired up, is at [v0id-user/webtransport](https://github.com/v0id-user/webtransport).
:::

::sep

## Streams carry bytes, not messages

Once a stream is long-lived, as it is when the server pushes events to the client, the end-of-stream signal isn't available, because the stream stays open. You need your own way to mark where one message ends and the next begins. The simplest option is a length prefix:

```plain
you write:  [len][json][len][json][len][json]...
you read:   accumulate, peek 4, wait for len more
```

On the server:

::codelabel[peer.go]

```go
var hdr [4]byte
binary.BigEndian.PutUint32(hdr[:], uint32(len(msg)))
p.evt.Write(hdr[:])
p.evt.Write(msg)
```

On the client:

::codelabel[client/src/App.tsx]

```typescript
if (buf.length < 4) break
const len = new DataView(buf.buffer, buf.byteOffset, 4).getUint32(0)
if (buf.length < 4 + len) break
onFrame(buf.subarray(4, 4 + len))
buf = buf.subarray(4 + len)
```

Neither QUIC nor the browser knows anything about those four bytes. They're an agreement between the code on both ends, and any consistent rule works: two bytes, a varint, newline-delimited JSON. Both sides just have to use the same one.

A WebSocket doesn't ask you to do this because its frame header already carries the length. WebTransport hands you the byte stream instead, so the framing is yours to write. In practice that's a small amount of buffer handling on the client: reads don't line up with messages, so one read may give you half a message or two and a half, and you hold the remainder until the rest arrives.

::sep

## Datagrams are bounded by the packet

The datagram lane doesn't need framing, because the packet provides the boundary:

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

One write becomes one packet, and one read returns exactly that packet. Nothing is merged and nothing is split, because a packet is indivisible on the wire. In exchange there are two limits to respect:

- **A size cap of roughly 1200 bytes**, which is the path MTU minus overhead. Read `maxDatagramSize` at send time rather than at connect time, because the value can shrink during a session.
- **No fragmentation.** RFC 9221 is explicit that DATAGRAM frames cannot be fragmented. What happens when you exceed the limit depends on which side you're on: in the browser the write promise resolves normally and the datagram is silently dropped, while `SendDatagram` in quic-go returns a `DatagramTooLargeError`. Either way, checking the size is your job.

::sep

## What reliable and unreliable actually mean

Everyone learns that TCP is reliable and ordered and UDP is neither. WebTransport turns that into a choice you make per message, so it's worth being precise about what the guarantees are. "Unreliable" is often read as meaning more than it does. A UDP datagram doesn't arrive corrupted or half-written:

```plain
UDP gives you:
  ✓ message boundaries   ← intact or absent
  ✓ integrity            ← checksummed; corrupt is discarded
  ✗ delivery
  ✗ ordering             ← A, B, C may arrive A, C, B
  ✗ deduplication        ← can arrive twice
```

A datagram either arrives whole or doesn't arrive at all. Unreliable *delivery* and unreliable *contents* are different things, and only the first one applies here. What you have to handle is a message that may be missing, out of order, or duplicated, rather than a partial one.

That leaves the two lanes as complements:

```plain
streams                  datagrams
─────────────────        ───────────────────
bytes, no boundaries     whole messages
all of them              some of them
in order                 in any order
you add framing          you add sequence numbers
```

Neither one gives you everything, so the choice is really about which gap you'd rather fill in.

::sep

## When unreliable is the better choice

Back to the cursor at 60Hz. A packet carrying a position is lost. Over TCP, and therefore over a WebSocket, that position is retransmitted and the newer positions queued behind it wait for it to arrive.

:::diagram[The Cost of Retransmitting a Cursor]

position lost → retransmit → 3 fresher positions wait → stale position arrives late

:::

The result is an out-of-date position, delivered late, having delayed newer ones on the way. For this kind of data, dropping the lost packet is the better outcome, because the next update is already on its way and it's more accurate than the one that was lost.

So unreliable delivery isn't a degraded version of reliable delivery. It's the right choice whenever data goes stale faster than a retransmission round trip takes. Chat messages belong on a stream. Cursor positions belong in datagrams. Having both available on one connection, and choosing between them per message, is the practical difference from a WebSocket.

::sep

## First impressions, then

The API is small: open a session, open streams, read and write, send and receive datagrams. There's no signalling, no session description, and no ICE candidates, which is most of what it removes compared to WebRTC.

What you get in return is the ability to choose reliability per message from a browser without adopting a peer-to-peer stack to get there. The underlying ideas are the ones QUIC and UDP already had. What changed is the amount of code it takes to reach them.

The example project I built while working through this, with server, client, hub, rooms and both lanes, is at [v0id-user/webtransport](https://github.com/v0id-user/webtransport).
