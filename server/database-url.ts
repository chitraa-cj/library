import parse, { type ConnectionOptions } from "pg-connection-string";

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
