import parse, { type ConnectionOptions } from "pg-connection-string";
import type pg from "pg";

export type PgSslConfig = pg.ConnectionConfig["ssl"];

/**
 * Returns a trimmed DATABASE_URL and fails fast with actionable errors.
 * Mutates process.env.DATABASE_URL so connect-pg-simple and other readers stay in sync.
 */
export function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "DATABASE_URL is missing. Add to .env, e.g. postgresql://postgres:YOUR_PASSWORD@localhost:5432/sacred_script_hub",
    );
  }

  let url = raw.replace(/^["']|["']$/g, "").trim();
  // Common .env typo: DATABASE_URL=DATABASE_URL=postgresql://...
  while (url.toUpperCase().startsWith("DATABASE_URL=")) {
    url = url.slice("DATABASE_URL=".length).trim();
  }

  let parsed: ConnectionOptions;
  try {
    parsed = parse(url);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`DATABASE_URL could not be parsed (${msg}). Check the URL syntax.`);
  }

  const host = (parsed.host ?? "").trim();
  const isSocket = host.startsWith("/");

  if (!isSocket && !host) {
    throw new Error(
      "DATABASE_URL has no host. Expected @localhost:5432/... (or another hostname). If the password contains #, wrap the whole URL in double quotes in .env so nothing after # is treated as a comment. Encode @ in passwords as %40.",
    );
  }

  if (!isSocket && host.toLowerCase() === "base") {
    throw new Error(
      'DATABASE_URL resolves to host "base", which is not valid. Use localhost or 127.0.0.1 for local Postgres. This usually means a typo, a placeholder left in the URL, or an unescaped @ in the password breaking the host segment.',
    );
  }

  process.env.DATABASE_URL = url;
  return url;
}

/**
 * SSL for node-postgres. AWS RDS often fails strict cert verification in Node
 * ("self-signed certificate in certificate chain"). Auto-relaxes for *.rds.amazonaws.com.
 * Override with DATABASE_SSL=verify (strict) or DATABASE_SSL=false (local, no SSL).
 */
export function resolvePgSsl(): PgSslConfig | undefined {
  const flag = (process.env.DATABASE_SSL ?? "").trim().toLowerCase();
  if (flag === "false" || flag === "disable" || flag === "off") {
    return undefined;
  }

  const url = process.env.DATABASE_URL ?? "";
  const isRds = /rds\.amazonaws\.com/i.test(url);
  const urlWantsSsl = /sslmode=(require|verify-full|verify-ca|prefer)/i.test(url);

  if (flag === "verify" || flag === "strict") {
    return true;
  }

  if (flag === "no-verify" || isRds || urlWantsSsl) {
    return { rejectUnauthorized: false };
  }

  return undefined;
}

/** Remove sslmode from URL so node-postgres uses our `ssl` option (not verify-full from the query string). */
function stripSslModeFromDatabaseUrl(url: string): string {
  try {
    const normalized = url.replace(/^postgresql:/i, "postgres:");
    const u = new URL(normalized);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    const rebuilt = u.toString().replace(/^postgres:/i, "postgresql:");
    return rebuilt.replace(/\?$/, "");
  } catch {
    return url
      .replace(/([?&])sslmode=[^&]*(&|$)/i, (_, sep, tail) => (tail === "&" ? sep : ""))
      .replace(/([?&])ssl=[^&]*(&|$)/i, (_, sep, tail) => (tail === "&" ? sep : ""))
      .replace(/\?&/, "?")
      .replace(/\?$/, "");
  }
}

export function resolvePgDbCredentials(): { url: string; ssl?: PgSslConfig } {
  const url = resolveDatabaseUrl();
  const ssl = resolvePgSsl();
  const useRelaxedSsl = ssl !== undefined && typeof ssl === "object" && ssl.rejectUnauthorized === false;
  return {
    url: useRelaxedSsl ? stripSslModeFromDatabaseUrl(url) : url,
    ...(ssl !== undefined ? { ssl } : {}),
  };
}

export function resolvePgPoolConfig(): pg.PoolConfig {
  const { url, ssl } = resolvePgDbCredentials();
  return {
    connectionString: url,
    ssl,
    connectionTimeoutMillis: 15_000,
  };
}
