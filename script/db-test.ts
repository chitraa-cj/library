import { config as loadDotenv } from "dotenv";
import pg from "pg";
import { resolvePgPoolConfig } from "../server/database-url";

loadDotenv({ path: ".env", override: true, quiet: true });

const cfg = resolvePgPoolConfig();
const hostHint = cfg.connectionString?.replace(/:[^:@/]+@/, ":***@").split("?")[0];

console.log("Testing Postgres:", hostHint);

const client = new pg.Client(cfg);
client
  .connect()
  .then(async () => {
    const r = await client.query("SELECT current_database() AS db, version()");
    console.log("DB connection OK");
    console.log("  database:", r.rows[0]?.db);
    console.log("  server:  ", String(r.rows[0]?.version).split("\n")[0]);
    await client.end();
  })
  .catch(async (e: Error) => {
    console.error("DB connection FAILED:", e.message);
    process.exitCode = 1;
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  });
