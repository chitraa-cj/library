import { db } from "./db";
import { books } from "@shared/schema";
import { eq } from "drizzle-orm";
import { seedDatabase } from "./seed";
import { seedBhagavadGita } from "./seed-gita";

const ISHA_SLUG = "isha-upanishad-bhashya";
const GITA_SLUG = "bhagavad-gita";

/**
 * Postgres-scraped Gita and Isha must exist for the public site when Strapi
 * duplicates are hidden (see LOCAL_STRAPI_DUPLICATES). Production DBs that
 * already had other books never ran the original empty-DB-only Isha seed.
 */
export async function ensureCanonicalLocalBooks(): Promise<void> {
  const [ishaRows, gitaRows] = await Promise.all([
    db.select({ id: books.id, slug: books.slug }).from(books).where(eq(books.slug, ISHA_SLUG)),
    db.select({ id: books.id, slug: books.slug }).from(books).where(eq(books.slug, GITA_SLUG)),
  ]);

  if (ishaRows.length === 0) {
    console.log("[Canonical] Isha Upanishad missing in Postgres — running Isha seed...");
    await seedDatabase();
  }

  if (gitaRows.length === 0) {
    console.log("[Canonical] Bhagavad Gita missing in Postgres — running Gita seed...");
    await seedBhagavadGita();
  }

  const [ishaAfter, gitaAfter] = await Promise.all([
    db.select({ id: books.id, totalVerses: books.totalVerses }).from(books).where(eq(books.slug, ISHA_SLUG)),
    db.select({ id: books.id, totalVerses: books.totalVerses }).from(books).where(eq(books.slug, GITA_SLUG)),
  ]);

  if (ishaAfter.length === 0) {
    console.error(
      "[Canonical] Isha Upanishad still missing after seed. Check DATABASE_URL and server logs for seed errors.",
    );
  } else {
    console.log(`[Canonical] Isha Upanishad OK (id=${ishaAfter[0].id}, verses=${ishaAfter[0].totalVerses ?? "?"})`);
  }

  if (gitaAfter.length === 0) {
    console.error(
      "[Canonical] Bhagavad Gita still missing after seed. Gita seed needs outbound HTTPS to vedicscriptures.github.io.",
    );
  } else {
    console.log(`[Canonical] Bhagavad Gita OK (id=${gitaAfter[0].id}, verses=${gitaAfter[0].totalVerses ?? "?"})`);
  }
}
