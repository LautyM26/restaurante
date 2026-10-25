import { z } from "zod";
const emptyAsUndefined = (value: unknown) => (value === "" ? undefined : value);

const trustProxy = z.preprocess(
  (value) => {
    if (value === "false") return false;
    if (value === "true") return true;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    return value;
  },
  z.union([z.boolean(), z.number().int().nonnegative()]),
);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  SUPABASE_URL: z.url({ protocol: /^https$/ }),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    )
    .refine((origins) => origins.length > 0),
  PORT: z.preprocess(
    emptyAsUndefined,
    z.coerce.number().int().min(1).max(65535).default(3000),
  ),
  LOG_LEVEL: z.preprocess(
    emptyAsUndefined,
    z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  ),
  TRUST_PROXY: z.preprocess(emptyAsUndefined, trustProxy.default(false)),
  DB_POOL_MAX: z.preprocess(
    emptyAsUndefined,
    z.coerce.number().int().positive().default(10),
  ),
  SEED_STAFF_USER_ID: z.preprocess(emptyAsUndefined, z.uuid().optional()),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates the environment. On failure it throws an error that names the
 * offending variables and never includes their values.
 */
export function parseEnv(env: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const names = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new Error(`Invalid environment variables: ${names.join(", ")}`);
  }
  return result.data;
}
