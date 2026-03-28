---
title: Email Tokenization — Identity Without Sensitive Information
date: 2025-11-21
slug: email-tokenization-identity-without-sensitive-information
---

## Why Separate Email From Identity?

When you build a login system or any website with users, the common approach is simple: collect things like the email, password, and username, then store them in a single table.

Something like this:

```plain
users
--------------------------------
id | email | password | username
```

Looks normal, right?

The problem is that the **email address** is sitting directly next to the user identity and password. Anyone with access to the database — even if it's just **read-only access** — can immediately see sensitive data.

Even worse, this violates a core principle related to **PII (Personally Identifiable Information)**.

You generally don’t want to directly tie a user’s identity to sensitive personal data like this.

***

## So What’s the Solution?

The idea is surprisingly simple.

Instead of storing everything together, we separate responsibilities:

* One place stores the **real email address**
* Another place stores the **login identity**
* The connection between them happens through a **token**, not the email itself

This small architectural change gives us several advantages:

* Isolation of sensitive information
* Reduced risk if one table leaks
* Better control over who can access what
* Cleaner system design since identity is no longer tied directly to sensitive fields

***

## How Do We Implement This?

Let’s look at a simple example.

### 1. A table that stores real emails, but indexed by a token

```plain
email_tokens
--------------------------------
token (PRIMARY KEY) | email | created_at
```

### 2. A table that stores user identities

```plain
identities
--------------------------------
id | username | password_hash | email_token (FK -> token) | created_at
```

Now the identity table **does not know the real email address**.

It only knows the **token**, and that token points to the actual email record.

In other words:

> “This identity is linked to that email.”

But the relationship is indirect, which is exactly what we want.

***

## Why Go Through All This Trouble?

Because good systems are designed for the **future**, not just for something that works today.

As a developer, you should think about:

* Designing proper system boundaries
* Separating **identity** from **PII**
* Understanding **exposure risk** and **attack surfaces**

Technically, this approach costs almost nothing to implement.

But architecturally, it gives you a **cleaner and safer system design**.

***

I also made a small example project showing how this approach can be implemented in Python if you're curious:

<https://github.com/v0id-user/emtok>

_This English version of the article was translated with the help of AI. Because the original post was written in Arabic, some nuances and details may not have carried over perfectly into the translation. For the most accurate version, you may prefer reading the original Arabic post._
