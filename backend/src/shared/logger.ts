import pino, { type DestinationStream, type Logger } from "pino";
import type { Env } from "../env.js";

export type { Logger };

const REDACTED = "[REDACTED]";
const TOKEN_PARAM = "accessToken";

// Decodes a query parameter name like URLSearchParams does ("+" -> space, then percent-decoding).
function decodeParamName(raw: string): string {
  const spaced = raw.replace(/\+/g, " ");
  try {
    return decodeURIComponent(spaced);
  } catch {
    return raw;
  }
}

export function redactUrl<T>(url: T): T | string {
  if (typeof url !== "string") return url;
  const hashIndex = url.indexOf("#");
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
  const queryIndex = beforeHash.indexOf("?");
  if (queryIndex === -1) return url;
  const path = beforeHash.slice(0, queryIndex + 1);
  const query = beforeHash
    .slice(queryIndex + 1)
    .split("&")
    .map((segment) => {
      const eq = segment.indexOf("=");
      if (eq === -1) return segment;
      const name = segment.slice(0, eq);
      return decodeParamName(name) === TOKEN_PARAM
        ? `${name}=${REDACTED}`
        : segment;
    })
    .join("&");
  return `${path}${query}${hash}`;
}

function redactQueryObject(query: unknown): unknown {
  if (typeof query !== "object" || query === null || Array.isArray(query)) {
    return query;
  }
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      key,
      decodeParamName(key) === TOKEN_PARAM ? REDACTED : value,
    ]),
  );
}

/**
 * Serializer for a `req` ALREADY serialized (by pino-std-serializers / pino-http).
 * Copies the object, redacts `url` and `query.accessToken`, keeps the rest
 * (remoteAddress, remotePort, ...).
 *
 * T17 wiring: pino-http wraps the serializer given in `serializers.req`
 * (wrapSerializers is on by default) and calls it with the serialized req, so:
 *   pinoHttp({ logger, serializers: { req: redactSerializedReq } })
 */
export function redactSerializedReq(req: unknown): unknown {
  if (typeof req !== "object" || req === null) return req;
  const copy: Record<string, unknown> = { ...(req as Record<string, unknown>) };
  if ("url" in copy) copy["url"] = redactUrl(copy["url"]);
  if ("query" in copy) copy["query"] = redactQueryObject(copy["query"]);
  return copy;
}

function serializeReq(req: unknown): unknown {
  const serialized = pino.stdSerializers.req(
    req as Parameters<typeof pino.stdSerializers.req>[0],
  );
  return redactSerializedReq(serialized);
}

export function createLogger(
  level: Env["LOG_LEVEL"],
  destination?: DestinationStream,
): Logger {
  return pino(
    {
      level,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          'res.headers["set-cookie"]',
        ],
        censor: REDACTED,
      },
      serializers: { req: serializeReq },
    },
    destination,
  );
}
