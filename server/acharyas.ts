/**
 * Read-only Acharya (guru-parampara) API for the reader app.
 *
 * The acharya_profiles table lives in the CMS's `ekatmadham` database (same RDS
 * instance as the reader's `sacred_script_hub` DB). We open a dedicated read-only
 * pool to it rather than duplicating the data. Override the target with
 * ACHARYA_DATABASE_URL; otherwise we derive it from DATABASE_URL by swapping the
 * database name to `ekatmadham`.
 */
import type { Express } from "express";
import pg from "pg";
import { resolvePgDbCredentials } from "./database-url";

function acharyaPoolConfig(): pg.PoolConfig {
  const { url, ssl } = resolvePgDbCredentials();
  const connectionString =
    process.env.ACHARYA_DATABASE_URL?.trim() ||
    url.replace(/\/sacred_script_hub(\?|$)/i, "/ekatmadham$1");
  return { connectionString, ssl, connectionTimeoutMillis: 15_000, max: 4 };
}

let pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!pool) pool = new pg.Pool(acharyaPoolConfig());
  return pool;
}

const LIST_SQL = `
  select slug, name_iast, name_devanagari, name_display, dates, lineage_order,
         category, avatar_url, bio_status,
         coalesce(jsonb_array_length(works_list), 0) as works_count,
         (bio_status = 'sourced') as has_bio
  from acharya_profiles
  order by lineage_order asc nulls last, id asc`;

const DETAIL_SQL = `
  select slug, name_iast, name_devanagari, name_display, aliases, dates,
         lineage_order, category, guru_devanagari, biography, works_list,
         avatar_url, bio_status, source_url
  from acharya_profiles
  where slug = $1
  limit 1`;

export function registerAcharyaRoutes(app: Express): void {
  app.get("/api/acharyas", async (_req, res) => {
    try {
      const { rows } = await getPool().query(LIST_SQL);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[acharyas] list failed:", message);
      res.status(503).json({ message: "Acharya data is temporarily unavailable." });
    }
  });

  app.get("/api/acharyas/:slug", async (req, res) => {
    try {
      const { rows } = await getPool().query(DETAIL_SQL, [req.params.slug]);
      if (rows.length === 0) {
        return res.status(404).json({ message: "Acharya not found." });
      }
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(rows[0]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[acharyas] detail failed:", message);
      res.status(503).json({ message: "Acharya data is temporarily unavailable." });
    }
  });
}
