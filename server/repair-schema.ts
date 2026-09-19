import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * `notes` and `verse_progress` store an opaque Strapi verse id that is NOT in
 * the local `verses` table, so `shared/schema.ts` intentionally declares no
 * foreign key on those columns. Older databases may still carry a stale FK
 * (e.g. `notes_verse_id_verses_id_fk`) that rejects every insert made with a
 * Strapi id — which silently broke note saving.
 *
 * Drop any such stale FK on boot. Idempotent and safe: it only touches these
 * two user tables, both of which the schema declares FK-free, and does nothing
 * when the constraints are already gone.
 */
export async function repairUserTableForeignKeys() {
  const tables = ["notes", "verse_progress"];
  for (const table of tables) {
    try {
      const res: any = await db.execute(sql`
        SELECT conname FROM pg_constraint
        WHERE contype = 'f' AND conrelid = ${table}::regclass
      `);
      const rows = (res.rows ?? res) as Array<{ conname: string }>;
      for (const { conname } of rows) {
        await db.execute(
          sql`ALTER TABLE ${sql.identifier(table)} DROP CONSTRAINT IF EXISTS ${sql.identifier(conname)}`,
        );
        console.log(`[schema-repair] dropped stale foreign key ${conname} on ${table}`);
      }
    } catch (err) {
      // Missing table (fresh DB) or insufficient privileges — log and continue.
      console.error(`[schema-repair] skipped ${table}:`, (err as Error).message);
    }
  }
}

/**
 * `users` and `sessions` are only ever created/altered by a manual
 * `npm run db:push`, so a deployed database drifts behind the schema every time
 * a column is added (e.g. `preferred_theme`, `preferred_font_scale`). Drizzle
 * selects every declared column by name, so one missing column makes *all*
 * user queries fail with SQLSTATE 42703 — which surfaced as a blanket 500 from
 * /api/auth/register and /api/auth/login while the rest of the app kept working.
 *
 * Bring both tables up to `shared/models/auth.ts` on boot. Every statement is
 * IF [NOT] EXISTS, so this is a no-op on an up-to-date database.
 */
export async function ensureAuthSchema() {
  try {
    // gen_random_uuid() is built in on Postgres 13+; older servers need pgcrypto.
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`).catch(() => {});

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()
      )
    `);

    const userColumns: Array<[string, string]> = [
      ["email", "varchar"],
      ["first_name", "varchar"],
      ["last_name", "varchar"],
      ["profile_image_url", "varchar"],
      ["password", "varchar"],
      ["preferred_language", "varchar(20)"],
      ["preferred_author", "varchar(200)"],
      ["preferred_theme", "varchar(10)"],
      ["preferred_font_scale", "varchar(8)"],
      ["created_at", "timestamp DEFAULT now()"],
      ["updated_at", "timestamp DEFAULT now()"],
    ];

    for (const [name, type] of userColumns) {
      const res: any = await db.execute(sql`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = ${name}
      `);
      const rows = (res.rows ?? res) as unknown[];
      if (rows.length > 0) continue;
      await db.execute(
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${sql.identifier(name)} ${sql.raw(type)}`,
      );
      console.log(`[schema-repair] added missing users.${name}`);
    }

    // Matches the drizzle `.unique()` on users.email, and registration's
    // duplicate-account check relies on it.
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)`,
    ).catch(() => {});

    // connect-pg-simple runs with createTableIfMissing: false, so without this
    // a fresh database logs in successfully but never persists the session.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid varchar PRIMARY KEY,
        sess jsonb NOT NULL,
        expire timestamp NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire)`);
  } catch (err) {
    console.error("[schema-repair] auth schema check failed:", (err as Error).message);
  }
}
