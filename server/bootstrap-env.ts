import { config as loadDotenv } from "dotenv";

// Must be imported before any module that reads process.env (e.g. db.ts).
// ESM hoists static imports, so this file is imported first from server/index.ts.
loadDotenv({
  path: ".env",
  override: process.env.NODE_ENV !== "production",
});
