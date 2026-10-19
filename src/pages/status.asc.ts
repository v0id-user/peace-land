import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { PRESENCE_KEY, type Presence } from '../lib/presence';

export const prerender = false;

// The laptop's last report, exactly as it was signed, wrapped with its signature into
// one armored OpenPGP message. Anyone holding my key can check it came from me:
//   curl -s https://www.v0id.me/status.asc | gpg --decrypt
// It is what the laptop last said, not the inactive the site infers from silence.

// Key ID of the signing key: the last 8 bytes of its fingerprint, 6BEC…1F4F0EDA64619E19.
const KEY_ID = [0x1f, 0x4f, 0x0e, 0xda, 0x64, 0x61, 0x9e, 0x19];

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// A new-format packet header. Reports are capped at 1024 bytes, well under the
// two-octet length limit of 8383.
function packet(tag: number, body: Uint8Array): Uint8Array {
  const n = body.length;
  const head = n < 192 ? [0xc0 | tag, n] : [0xc0 | tag, ((n - 192) >> 8) + 192, (n - 192) & 0xff];
  return concat(Uint8Array.from(head), body);
}

// Where the body of a signature packet starts, for either header format.
function bodyOffset(sig: Uint8Array): number {
  if (sig[0] & 0x40) return sig[1] < 192 ? 2 : sig[1] < 224 ? 3 : 6;
  return 1 + [1, 2, 4][sig[0] & 0x03];
}

// gpg reads a signature placed before its data as an old PGP 2 message and refuses it,
// so the message is built the modern way: a one-pass header, the data, the signature.
function signedMessage(data: Uint8Array, sig: Uint8Array): Uint8Array {
  const s = bodyOffset(sig);
  // Signature v4 order: version, type, public-key algorithm, hash algorithm.
  const [type, publicKeyAlgorithm, hashAlgorithm] = [sig[s + 1], sig[s + 2], sig[s + 3]];
  // One-pass v3 order: version, type, hash algorithm, public-key algorithm, key ID, last.
  const onePass = packet(4, Uint8Array.from([3, type, hashAlgorithm, publicKeyAlgorithm, ...KEY_ID, 1]));
  // Literal data: binary, no file name, no date.
  const literal = packet(11, concat(Uint8Array.from([0x62, 0, 0, 0, 0, 0]), data));
  return concat(onePass, literal, sig);
}

function armor(bytes: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/.{1,64}/g, '$&\n');
  return `-----BEGIN PGP MESSAGE-----\n\n${b64}-----END PGP MESSAGE-----\n`;
}

export const GET: APIRoute = async () => {
  const kv = (env as any).SESSION as KVNamespace | undefined;
  const p = await kv?.get<Presence>(PRESENCE_KEY, { type: 'json', cacheTtl: 30 });
  if (!p?.body || !p.sig) return new Response('no signed report yet\n', { status: 404 });

  const sig = Uint8Array.from(atob(p.sig), (c) => c.charCodeAt(0));
  return new Response(armor(signedMessage(new TextEncoder().encode(p.body), sig)), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
};
