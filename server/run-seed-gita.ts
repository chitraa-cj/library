import { seedBhagavadGita } from "./seed-gita";

(async () => {
  try {
    await seedBhagavadGita();
    console.log("Done!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
})();
