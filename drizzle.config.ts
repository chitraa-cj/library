import { config as loadDotenv } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrl, resolvePgSsl } from "./server/database-url";

// Always load .env for drizzle-kit CLI (deploy/migrate), even when NODE_ENV=production.
loadDotenv({ path: ".env", override: true, quiet: true });

const databaseUrl = resolveDatabaseUrl();
const ssl = resolvePgSsl();

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    ...(ssl !== undefined ? { ssl } : {}),
  },
});
