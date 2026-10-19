import { PGP_PUBLIC_KEY_ARMORED } from './pgpKey';

// Only a detached OpenPGP signature by the site's own key (key/*.asc) is accepted.
// The Worker holds the public key and no secret, so nothing stored on Cloudflare
// can be used to forge a request. openpgp is imported here, not at the top, so only
// the routes that check a signature pay for loading it.
export async function signedByMe(body: Uint8Array, signatureB64: string): Promise<boolean> {
  try {
    const openpgp = await import('openpgp');
    const binarySignature = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    const [verificationKeys, signature, message] = await Promise.all([
      openpgp.readKey({ armoredKey: PGP_PUBLIC_KEY_ARMORED }),
      openpgp.readSignature({ binarySignature }),
      openpgp.createMessage({ binary: body }),
    ]);
    // expectSigned makes verify throw unless a signature by verificationKeys checks out.
    await openpgp.verify({ message, signature, verificationKeys, expectSigned: true });
    return true;
  } catch {
    return false;
  }
}
