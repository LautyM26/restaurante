const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Aborts unless the URL points to a local database whose name ends in
 * `_test`. Protects restaurante_dev and any remote (Supabase) database from
 * the migrate + TRUNCATE done by the integration global setup.
 */
export function assertTestDatabaseUrl(name: string, raw: string | undefined) {
  if (!raw) throw new Error(`${name} is not set: refusing to run tests`);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} is not a valid URL: refusing to run tests`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!LOCAL_HOSTS.has(url.hostname) || !database.endsWith("_test")) {
    throw new Error(
      `${name} must point to a local database whose name ends in "_test" ` +
        `(got host "${url.hostname}", database "${database}"): refusing to run tests`,
    );
  }
}
