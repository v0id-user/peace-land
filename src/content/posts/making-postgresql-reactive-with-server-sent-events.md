---
title: Making PostgreSQL Reactive with Server-Sent Events
date: 2025-01-19
slug: postgresql-reactive-sse
draft: false
---

Most people reach for WebSockets the moment they need real-time updates. Or they pick a specialized database like Convex that bundles reactivity out of the box. Both are valid, but there's a third option nobody talks about enough: PostgreSQL already has a pub/sub system built in, and it's been there since version 9.0.

This is a writeup of a project I built to explore exactly that: real-time reactive updates using Postgres `NOTIFY/LISTEN` + server-sent events, no WebSockets, no external message broker.

:::note

This was inspired by exploring Convex DB's reactivity model. The question I kept asking was: do we actually need a specialized database for this, or can Postgres do it?

:::

::sep

## The Mechanism: pg_notify

Postgres has two commands that most backend devs have never touched:

- `LISTEN channel_name` — subscribe to a channel
- `NOTIFY channel_name, 'payload'` — broadcast a message to all listeners on that channel

The payload is a plain string, so in practice you serialize JSON into it. Any connected client listening on that channel gets the notification instantly when `NOTIFY` fires.

The real power comes from **triggers**. Instead of manually calling `NOTIFY` from application code, you attach a trigger to a table that fires automatically on `INSERT` or `UPDATE`. The database itself becomes the event emitter.

:::diagram[The Full Flow]

DB Row Change → Trigger Fires → pg_notify → asyncpg Listener → FastAPI SSE → Browser

:::

::sep

## The Trigger Boilerplate

Here's the core of it. This Python function takes any SQLAlchemy model class and automatically wires up a trigger + notification function for it:

::codelabel[sql_create_trigger_boilerplate.py]

```python
import asyncpg

POSTGRESQL_LOCAL = "DATABASE_URL"

async def setup_model_trigger(model_class):
    """
    Create a PostgreSQL trigger for any SQLAlchemy model class.
    Notifies on INSERT and UPDATE with all columns serialized as JSON.
    Returns the channel name to listen on.
    """
    if not hasattr(model_class, "__table__"):
        raise ValueError("Input must be a SQLAlchemy model class")

    table_name = model_class.__tablename__
    channel_name = f"{table_name}_changes"
    trigger_name = f"{table_name}_notify_trigger"
    function_name = f"notify_{table_name}_change"

    columns = [column.name for column in model_class.__table__.columns]
    json_fields = ",\n  ".join([f"'{col}', NEW.{col}" for col in columns])

    conn = await asyncpg.connect(POSTGRESQL_LOCAL)
    try:
        await conn.execute(f"""
            CREATE OR REPLACE FUNCTION {function_name}()
            RETURNS trigger AS $$
            BEGIN
                PERFORM pg_notify(
                    '{channel_name}',
                    json_build_object(
                        'operation', TG_OP,
                        {json_fields}
                    )::text
                );
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """)

        await conn.execute(f"""
            DROP TRIGGER IF EXISTS {trigger_name} ON {table_name};
            CREATE TRIGGER {trigger_name}
                AFTER INSERT OR UPDATE ON {table_name}
                FOR EACH ROW
                EXECUTE FUNCTION {function_name}();
        """)
    finally:
        await conn.close()

    return channel_name
```

Call `setup_model_trigger(Newsletter)` once at startup and you get back a channel name like `newsletters_changes`. Now anything listening on that channel gets notified automatically whenever a row is inserted or updated, no application-level plumbing needed.

:::note

The function uses `CREATE OR REPLACE` so it's idempotent. Safe to call on every startup.

:::

::sep

## The FastAPI Side: Listening with asyncpg

Once the trigger is wired up, you need a process that holds a persistent Postgres connection and listens on the channel. `asyncpg` has a clean API for this:

::codelabel[main.py]

```python
import asyncio
import asyncpg
import json
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

async def listen_to_postgres(channel: str):
    conn = await asyncpg.connect(DATABASE_URL)
    queue = asyncio.Queue()

    async def handle_notification(conn, pid, channel, payload):
        await queue.put(payload)

    await conn.add_listener(channel, handle_notification)
    return conn, queue

@app.get("/stream")
async def stream_updates():
    conn, queue = await listen_to_postgres("newsletters_changes")

    async def event_generator():
        try:
            while True:
                payload = await queue.get()
                yield f"data: {payload}\n\n"
        finally:
            await conn.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

The `add_listener` call registers a callback that fires every time Postgres sends a notification on that channel. We dump it into an asyncio queue, and the SSE generator pulls from that queue and streams it to the client.

::sep

## Why SSE and Not WebSockets?

This question comes up immediately so let's address it directly.

WebSockets are bidirectional. For real-time *updates* where data only flows from server to client, that's overkill. SSE is:

- Unidirectional (server to client only)
- A plain HTTP connection, meaning it works through most proxies and load balancers without special config
- Built-in reconnection handling in the browser (`EventSource` API reconnects automatically)
- Simpler to implement and reason about

:::warning

SSE has a browser limit of 6 concurrent connections per domain (HTTP/1.1). If you're building something with many concurrent SSE streams per user, either use HTTP/2 or reconsider the architecture.

:::

For a newsletter update feed, SSE is exactly right. You don't need the client to send data back.

::sep

## The Browser Side

The client is three lines:

```javascript
const source = new EventSource('/stream');
source.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // update the UI
};
```

`EventSource` handles reconnection, error recovery, and keeps the connection alive. The browser will automatically reconnect if the connection drops.

::sep

## What This Is Actually Useful For

The pattern generalizes beyond newsletters:

- **Live dashboards** — DB metrics, order counts, inventory levels
- **Collaborative tools** — any shared state that multiple clients need to see updated
- **Audit feeds** — surface row-level changes in real time to a monitoring UI
- **Cache invalidation** — instead of TTL-based expiry, invalidate on actual data change

:::diagram[Generalized Pattern]

Any Table → Trigger → pg_notify → Listener Pool → SSE → N Clients

:::

The key insight is that the trigger approach decouples the event emission from application code. Even if you have multiple services writing to the same table, every write triggers the notification. You don't have to coordinate across services to fire events.

::sep

## TLDR

:::tldr

Postgres `NOTIFY/LISTEN` + database triggers give you reactive updates without a specialized real-time database. Pair it with server-sent events and asyncpg and you have a lightweight, production-viable real-time system. The full project is at [v0id-user/Postgres-Reactive-SSE-Example](https://github.com/v0id-user/Postgres-Reactive-SSE-Example).

:::
