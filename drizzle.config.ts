import { config as loadDotenv } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolvePgDbCredentials } from "./server/database-url";

// Always load .env for drizzle-kit CLI (deploy/migrate), even when NODE_ENV=production.
loadDotenv({ path: ".env", override: true, quiet: true });

const dbCredentials = resolvePgDbCredentials();

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials,
});
