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
