import {
  createLocalJWKSet,
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from "jose";
import type { Clock } from "@/shared/clock";

export interface VerifiedToken {
  userId: string;
  exp: number;
}

// Resolves to null when the token is not valid (bad signature, iss, aud,
// expired, disallowed algorithm, missing sub/exp). Only a JWKS fetch timeout
// or a network error is rethrown. A JWKS response that is not 200 or not a
// valid key set is a JOSEError too, so it also resolves to null (fails
// closed as 401, D-231).
export interface TokenVerifier {
  verify(token: string): Promise<VerifiedToken | null>;
}

// Asymmetric only: HS256 is never accepted (D-088).
const ALLOWED_ALGORITHMS = ["ES256", "RS256"];
const AUDIENCE = "authenticated";

interface VerifierOptions {
  supabaseUrl: string;
  getKey: JWTVerifyGetKey;
  clock?: Clock;
}

function createVerifier(options: VerifierOptions): TokenVerifier {
  const { supabaseUrl, getKey, clock } = options;
  return {
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, getKey, {
          issuer: `${supabaseUrl}/auth/v1`,
          audience: AUDIENCE,
          algorithms: ALLOWED_ALGORITHMS,
          ...(clock !== undefined && { currentDate: clock.now() }),
        });
        const { sub, exp } = payload;
        if (typeof sub !== "string" || sub === "" || typeof exp !== "number") {
          return null;
        }
        return { userId: sub, exp };
      } catch (error) {
        if (
          error instanceof errors.JOSEError &&
          !(error instanceof errors.JWKSTimeout)
        ) {
          return null;
        }
        throw error;
      }
    },
  };
}

export function createTokenVerifier(
  supabaseUrl: string,
  clock?: Clock,
): TokenVerifier {
  const getKey = createRemoteJWKSet(
    new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
  );
  return createVerifier({
    supabaseUrl,
    getKey,
    ...(clock !== undefined && { clock }),
  });
}

export function createLocalTokenVerifier(
  supabaseUrl: string,
  jwks: JSONWebKeySet,
  clock?: Clock,
): TokenVerifier {
  return createVerifier({
    supabaseUrl,
    getKey: createLocalJWKSet(jwks),
    ...(clock !== undefined && { clock }),
  });
}
