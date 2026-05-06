---
title: Storing private keys on servers
date: 2026-05-06
slug: storing-private-keys-on-servers
draft: false
description: How to store private keys on the server securely, how proton and other services do it.
---

::sep

## Well

for me that was just crazy to think about and for a good reason, it shouldn't be possible, but the key was in front of my eyes the whole time and it's actually simple!

### Everyone 

says End to End Encryption (E2EE) means the server doesn't have your private key. And that I've lived with for an embarrassingly long time and it was super limiting to me. E2EE meant keys live locally and you need a whole private channel to wire the private keys between different devices. And it meant that E2EE is a very niche use case and can't be scaled.

::sep

## Then 

in a random day I was using my Proton mail and browsing different emails and I got struck for no reason and realized wait a second, how does ProtonMail store my damn private key? 
You see when you use proton, if you changed your password you literally lose all old emails and there is no way to restore them except if you remember the old password, and that is a real thing that happens, I have lost a lot of emails on my old account because of it.

And it clicked, "Phrasekeys". Phrasekeys is a way PGP uses to encrypt your private keys so you can store them safely anywhere and then they get decrypted at rest so you can use them to encrypt or sign your stuff. Then I searched and [I actually found it](https://proton.me/support/how-is-the-private-key-stored):

> Your Proton Mail private key is generated in your browser. Before sending the private key to the server for storage, we encrypt it with your password.

::sep

## For years 

I just took it for granted that there is not much use case for E2EE except super niche ones. This actually made me think why E2EE is not the default, even for a simple use case that is not technical. Like something that exists and you shouldn't even think about how it works.

Well an easy answer is simply the boilerplate for it. Although Proton says they use your password, they're actually not really using your password to encrypt the key in your browser and they explain it later. But here is the deal.

When you sign up, your browser generates a fresh keypair locally. Your password gets fed into a key derivation function that spits out two independent secrets. One of them encrypts your private key right there in the browser, and the encrypted blob gets uploaded to the server. The other one is sent up as your login credential, and the server stores a hash of it next to your email. Your actual password never leaves your device.

::codelabel[client.py — key derivation]

```python
from argon2.low_level import hash_secret_raw, Type

def derive_keys(password: str, salt: bytes) -> tuple[bytes, bytes]:
    # One password in, 64 bytes out, split into two independent 32-byte secrets.
    raw = hash_secret_raw(
        secret=password.encode(),
        salt=salt,
        time_cost=3,
        memory_cost=64 * 1024,  # 64 MiB
        parallelism=4,
        hash_len=64,
        type=Type.ID,
    )
    auth_key = raw[:32]   # sent to server for login
    wrap_key = raw[32:]   # stays local, unlocks the private key
    return auth_key, wrap_key
```

When you log back in later, the same thing happens in reverse. You type your password, your browser derives the same two secrets from it, sends the login one up to authenticate, and gets back the encrypted private key. Then it uses the other secret to unlock the key locally. The server checked that you knew the password, but it never saw the password itself, and it never saw the secret that actually decrypts your key.

Same password, two derived secrets, two different jobs. The server gets to verify it's really you, but it never sees the secret that actually decrypts your key.

:::diagram[Two-Secret Derivation]
Password → KDF (Argon2id) → auth_key + wrap_key → server sees auth_key, device keeps wrap_key
:::

If you think of it, this is also how vault apps like 1Password and others work. You lose your password, you lose your data.

There is one weakness worth being honest about though, because most explainers skip it. If you access your E2EE service through a browser, the server is also the thing delivering the JavaScript that runs the crypto on every page load. 

:::warning
A compromised server could ship a slightly modified version of that JavaScript to a specific user, one that quietly captures their password before it gets fed into the key derivation. The math is still perfect, the trust hole is in the delivery. Native apps and signed browser extensions mostly close this gap because the code is fetched and updated through a separate channel. Pure web apps fundamentally can't. This is why Signal generates keys on-device and never has them server-side at all, it's a different tradeoff for a different problem.
:::

::codelabel[server view — everything stored for one user]

```python
# Everything the server has on disk for one user:
{
    "username":          "alice@example.com",
    "salt":              b"\xe0\x98\xa6\xc5...",   # 16 random bytes
    "auth_key_hash":     b"\x87\xd9\x48\x61...",   # SHA-256 of auth_key
    "encrypted_private": b"\x8e\x13\xbe\xf0...",   # opaque ciphertext
    "public_key":        b"\x82\xff\xbe\xeb...",   # safe to share
}
# Nothing in here decrypts anything. That's the whole point.
```

What surprises me looking back is that I was confused not because the answer was hard, but because I had accepted the wrong constraint. "The server can't have your key" isn't quite right, the real thing is "the server can't _read_ your key", and that is a much weaker requirement. That gap is where a whole category of products lives.

:::tldr
E2EE doesn't require the private key to live only on your device. Run your password through a KDF to derive two independent secrets: one authenticates with the server, the other unlocks the locally-encrypted private key the server stores for you. The server never sees the password or the unwrapping secret. The math is solid, the only soft spot is JavaScript delivery from the same server.
:::
