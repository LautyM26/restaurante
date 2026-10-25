import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  type CryptoKey,
  type JSONWebKeySet,
} from "jose";

export const TEST_SUPABASE_URL = "https://test.supabase.co";
export const TEST_KID = "test-key";

export interface TestKeys {
  privateKey: CryptoKey;
  jwks: JSONWebKeySet;
}

export async function createTestKeys(kid = TEST_KID): Promise<TestKeys> {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwk = await exportJWK(publicKey);
  return {
    privateKey,
    jwks: { keys: [{ ...jwk, kid, alg: "ES256", use: "sig" }] },
  };
}

export interface SignOptions {
  sub?: string;
  iss?: string;
  aud?: string;
  // Absolute expiration, seconds since epoch.
  exp?: number;
  iat?: number;
  kid?: string;
  // Sign with this key instead of the default one (foreign-signature case).
  privateKey?: CryptoKey;
  // Sign with HS256 using this secret (negative case).
  hs256Secret?: Uint8Array;
}

export async function signTestToken(
  keys: TestKeys,
  options: SignOptions = {},
): Promise<string> {
  const iat = options.iat ?? Math.floor(Date.now() / 1000);
  const jwt = new SignJWT({})
    .setSubject(options.sub ?? "11111111-1111-4111-8111-111111111111")
    .setIssuer(options.iss ?? `${TEST_SUPABASE_URL}/auth/v1`)
    .setAudience(options.aud ?? "authenticated")
    .setIssuedAt(iat)
    .setExpirationTime(options.exp ?? iat + 3600);
  if (options.hs256Secret !== undefined) {
    return jwt
      .setProtectedHeader({ alg: "HS256", kid: options.kid ?? TEST_KID })
      .sign(options.hs256Secret);
  }
  return jwt
    .setProtectedHeader({ alg: "ES256", kid: options.kid ?? TEST_KID })
    .sign(options.privateKey ?? keys.privateKey);
}
