// Signed, expiring session tokens for the single shared-password gate.
// Replaces the old `Buffer.from(password).toString("base64")` cookie, which
// was reversible (atob() recovers the plaintext password) and never expired.
//
// Token shape: `${expiresAtMs}.${hmacSignatureBase64Url}`. The HMAC key is
// derived from SITE_PASSWORD itself plus a fixed app-specific string — this
// requires no new env var (nothing for Efton to configure in Vercel), and
// HMAC is one-way: unlike base64, the signature cannot be inverted to reveal
// SITE_PASSWORD even if the cookie is captured. Uses Web Crypto (`crypto.subtle`)
// so it runs identically in the Edge middleware and Node API routes.

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days — matches prior cookie maxAge
const HMAC_CONTEXT = "simporic-session-v1";

async function hmacKey(sitePassword: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${sitePassword}:${HMAC_CONTEXT}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(sitePassword: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  const key = await hmacKey(sitePassword);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${Buffer.from(sig).toString("base64url")}`;
}

export async function verifySessionToken(
  token: string | undefined,
  sitePassword: string
): Promise<boolean> {
  if (!token) return false;

  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  let sigBytes: Uint8Array<ArrayBuffer>;
  try {
    // Buffer's Uint8Array is typed as backed by ArrayBufferLike (which
    // includes SharedArrayBuffer), but crypto.subtle.verify's BufferSource
    // wants a plain ArrayBuffer-backed view — copy into one explicitly via
    // toJSON() rather than spreading (spread needs downlevelIteration at
    // this tsconfig's target).
    sigBytes = new Uint8Array(Buffer.from(sigB64, "base64url").toJSON().data);
  } catch {
    return false;
  }

  const key = await hmacKey(sitePassword);
  // crypto.subtle.verify does a constant-time comparison internally.
  return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payload));
}
