import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { resolvePgPoolConfig } from "./database-url";

const pool = new pg.Pool(resolvePgPoolConfig());

export const db = drizzle(pool, { schema });
