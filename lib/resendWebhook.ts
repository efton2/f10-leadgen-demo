// Verifies Resend's Svix-format webhook signatures without pulling in the
// svix package — Resend signs with the same scheme, just three headers.
import crypto from "crypto";

const TOLERANCE_SECONDS = 5 * 60;

export function verifyResendSignature(
  payload: string,
  headers: { id: string; timestamp: string; signature: string },
  secret: string
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;

  const ts = Number(headers.timestamp);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${headers.id}.${headers.timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const expectedBuf = Buffer.from(expected);

  return headers.signature.split(" ").some((part) => {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    const sigBuf = Buffer.from(sig ?? "");
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}
