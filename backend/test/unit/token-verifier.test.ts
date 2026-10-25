import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { createLocalTokenVerifier } from "@/modules/staff/token-verifier";
import {
  TEST_SUPABASE_URL,
  createTestKeys,
  signTestToken,
  type TestKeys,
} from "../helpers/jwt";

const NOW = new Date("2026-01-01T12:00:00.000Z");
const nowSec = Math.floor(NOW.getTime() / 1000);
const clock = { now: () => NOW };
const SUB = "22222222-2222-4222-8222-222222222222";

let keys: TestKeys;
let otherKeys: TestKeys;

beforeAll(async () => {
  keys = await createTestKeys();
  otherKeys = await createTestKeys();
});

function verifier() {
  return createLocalTokenVerifier(TEST_SUPABASE_URL, keys.jwks, clock);
}

describe("TokenVerifier", () => {
  it("accepts a valid token and returns userId and exp", async () => {
    const exp = nowSec + 600;
    const token = await signTestToken(keys, { sub: SUB, iat: nowSec, exp });
    expect(await verifier().verify(token)).toEqual({ userId: SUB, exp });
  });

  it("rejects a token signed with a foreign key", async () => {
    const token = await signTestToken(keys, {
      iat: nowSec,
      privateKey: otherKeys.privateKey,
    });
    expect(await verifier().verify(token)).toBeNull();
  });

  it("rejects a different issuer", async () => {
    const token = await signTestToken(keys, {
      iat: nowSec,
      iss: "https://evil.supabase.co/auth/v1",
    });
    expect(await verifier().verify(token)).toBeNull();
  });

  it("rejects a different audience", async () => {
    const token = await signTestToken(keys, { iat: nowSec, aud: "anon" });
    expect(await verifier().verify(token)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signTestToken(keys, {
      iat: nowSec - 7200,
      exp: nowSec - 3600,
    });
    expect(await verifier().verify(token)).toBeNull();
  });

  it("rejects HS256 tokens", async () => {
    const token = await signTestToken(keys, {
      iat: nowSec,
      hs256Secret: new TextEncoder().encode(
        "a-shared-secret-of-32-bytes-long!!",
      ),
    });
    expect(await verifier().verify(token)).toBeNull();
  });

  it("rejects an asymmetric algorithm outside the allowlist (ES384)", async () => {
    // The key is in the JWKS, so only the algorithm allowlist rejects it.
    const { publicKey, privateKey } = await generateKeyPair("ES384");
    const jwk = await exportJWK(publicKey);
    const jwks = { keys: [{ ...jwk, kid: "es384", alg: "ES384", use: "sig" }] };
    const token = await new SignJWT({})
      .setSubject(SUB)
      .setIssuer(`${TEST_SUPABASE_URL}/auth/v1`)
      .setAudience("authenticated")
      .setIssuedAt(nowSec)
      .setExpirationTime(nowSec + 600)
      .setProtectedHeader({ alg: "ES384", kid: "es384" })
      .sign(privateKey);
    const es384Verifier = createLocalTokenVerifier(
      TEST_SUPABASE_URL,
      jwks,
      clock,
    );
    expect(await es384Verifier.verify(token)).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    expect(await verifier().verify("not-a-jwt")).toBeNull();
  });
});
