import type { RequestHandler } from "express";
import type { PrismaClient } from "@/generated/prisma/client";
import type { TokenVerifier } from "@/modules/staff/token-verifier";
import { AppError } from "@/shared/errors";

export const UNAUTHORIZED_MESSAGE = "Authentication required";

export interface StaffContext {
  userId: string;
  restaurantId: string;
}

// `invalid_token` -> REST 401 / WS 4401; `not_staff` -> REST 401 / WS 4403.
type StaffAuthResult =
  | { ok: true; staff: StaffContext; exp: number }
  | { ok: false; reason: "invalid_token" | "not_staff" };

interface StaffAuthDeps {
  prisma: PrismaClient;
  tokenVerifier: TokenVerifier;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Scheme is case-insensitive (RFC 7235); exactly one space; token has no
// whitespace. Anything else counts as no credentials.
const BEARER_PATTERN = /^Bearer ([^\s]+)$/i;

export function parseBearerToken(header: string | undefined): string | null {
  if (header === undefined) return null;
  const match = BEARER_PATTERN.exec(header);
  return match?.[1] ?? null;
}

// Verifier infrastructure errors (JWKS timeout/network) are not caught here.
export async function resolveStaff(
  deps: StaffAuthDeps,
  token: string,
): Promise<StaffAuthResult> {
  const verified = await deps.tokenVerifier.verify(token);
  if (verified === null) return { ok: false, reason: "invalid_token" };
  // A non-UUID `sub` cannot be a StaffMember (the column is a uuid).
  if (!UUID_PATTERN.test(verified.userId)) {
    return { ok: false, reason: "not_staff" };
  }
  const member = await deps.prisma.staffMember.findUnique({
    where: { userId: verified.userId },
  });
  if (member === null) return { ok: false, reason: "not_staff" };
  return {
    ok: true,
    staff: { userId: member.userId, restaurantId: member.restaurantId },
    exp: verified.exp,
  };
}

function unauthorized(): AppError<"UNAUTHORIZED"> {
  return new AppError("UNAUTHORIZED", 401, UNAUTHORIZED_MESSAGE);
}

export function requireStaff(deps: StaffAuthDeps): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = parseBearerToken(req.headers.authorization);
      if (token === null) throw unauthorized();
      const result = await resolveStaff(deps, token);
      if (!result.ok) throw unauthorized();
      res.locals["staff"] = result.staff;
      next();
    } catch (error) {
      next(error);
    }
  };
}
