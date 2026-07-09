import crypto from "node:crypto";

import { importJWK, jwtVerify, decodeProtectedHeader, type JWK } from "jose";

import { plaid } from "@/lib/plaid";

// Plaid webhook verification (https://plaid.com/docs/api/webhooks/webhook-verification/):
// 1. The Plaid-Verification header is an ES256 JWT.
// 2. Fetch the signing key by `kid` from /webhook_verification_key/get.
// 3. Verify the JWT and compare its request_body_sha256 to the raw body hash.

const keyCache = new Map<string, JWK>();

async function getVerificationKey(keyId: string): Promise<JWK> {
  const cached = keyCache.get(keyId);
  if (cached) return cached;
  const resp = await plaid.webhookVerificationKeyGet({ key_id: keyId });
  const jwk = resp.data.key as unknown as JWK;
  keyCache.set(keyId, jwk);
  return jwk;
}

export async function verifyPlaidWebhook(
  rawBody: string,
  verificationHeader: string | null
): Promise<boolean> {
  if (!verificationHeader) {
    // Sandbox-only escape hatch so local tests can POST the endpoint
    // directly. Production requests must always carry the header.
    return process.env.PLAID_ENV !== "production";
  }

  try {
    const { kid, alg } = decodeProtectedHeader(verificationHeader);
    if (alg !== "ES256" || !kid) return false;

    const jwk = await getVerificationKey(kid);
    const key = await importJWK(jwk, "ES256");
    const { payload } = await jwtVerify(verificationHeader, key, {
      maxTokenAge: "5 min",
    });

    const bodyHash = crypto
      .createHash("sha256")
      .update(rawBody, "utf8")
      .digest("hex");
    const expected = payload.request_body_sha256;
    return (
      typeof expected === "string" &&
      crypto.timingSafeEqual(Buffer.from(bodyHash), Buffer.from(expected))
    );
  } catch (error) {
    console.error("plaid webhook verification failed", error);
    return false;
  }
}
