import { config as loadDotenv } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrl } from "./server/database-url";

loadDotenv({
  path: ".env",
  override: process.env.NODE_ENV !== "production",
});

const databaseUrl = resolveDatabaseUrl();

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
