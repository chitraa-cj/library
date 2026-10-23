/**
 * Regression: commentary options must not amplify load on a struggling Strapi.
 *
 * 2026-10-23: Strapi slowed down, the light commentary scan timed out, and the reader
 * answered every timeout with a FULL-book hydration (every section's manthras, 6 at a
 * time) — more load, more timeouts, more fallbacks. A trivial Strapi request took 36s.
 * When the full-book load failed too, "no commentary" was cached for the book.
 *
 * Runs the real server/strapi.ts against an in-process mock Strapi:
 *
 *   npx tsx script/test-commentary-options-backpressure.ts
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

type Mode = "healthy" | "light-scan-times-out" | "light-scan-empty-book-fails";
let mode: Mode = "healthy";
const hits = { lightScan: 0, fullBook: 0 };

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://mock");
  const json = (body: unknown, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const page = (data: unknown[]) => json({ data, meta: { pagination: { page: 1, pageCount: 1, total: data.length } } });

  // Full-book hydration: the populated grantha, its sections, and per-section manthras.
  const isFullBook =
    url.pathname.startsWith("/api/sections") ||
    (url.pathname.startsWith("/api/granthas/") && url.searchParams.has("populate[0]")) ||
    (url.pathname === "/api/manthras" && url.searchParams.has("filters[Section][documentId]"));
  if (isFullBook) {
    hits.fullBook++;
    if (mode === "light-scan-empty-book-fails") return json({ error: "boom" }, 500);
    return json({ error: "full book should not be needed in this test" }, 500);
  }

  if (url.pathname.startsWith("/api/granthas/")) {
    return json({ data: { documentId: "book-1", BhashyamAuthor: "Sri Shankaracharya", BhashyamName: "Bhashyam" } });
  }

  if (url.pathname === "/api/manthras" && url.searchParams.has("filters[Section][grantha][documentId]")) {
    hits.lightScan++;
    if (mode === "light-scan-times-out") return; // never answer: the client's timeout fires
    if (mode === "light-scan-empty-book-fails") return page([]);
    return page([
      {
        id: 1,
        BhashyamEntry: { SanskritTextEntry: [{ type: "paragraph", children: [{ type: "text", text: "भाष्यम्" }] }] },
        Teekas: [],
      },
    ]);
  }
  json({ data: [] });
});

await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const port = (server.address() as AddressInfo).port;

Object.assign(process.env, {
  STRAPI_URL: `http://127.0.0.1:${port}`,
  STRAPI_API_TOKEN: "mock",
  STRAPI_TIMEOUT_MS: "300",
  STRAPI_HEAVY_TIMEOUT_MS: "300",
  STRAPI_FETCH_RETRIES: "0",
  CMS_BREAKER_THRESHOLD: "1000",
  CONTENT_CACHE_DISK: "0",
});
const strapi = await import("../server/strapi");

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

console.log("\nStrapi timing out on the light scan");
mode = "light-scan-times-out";
const r1 = await strapi.strapiGetCommentaryOptionsByBookId("book-1");
check("returns null for this request", r1 === null, JSON.stringify(r1));
check("does NOT fall back to a full-book hydration", hits.fullBook === 0, `${hits.fullBook} full-book requests`);

console.log("\nStrapi recovers");
mode = "healthy";
const r2 = await strapi.strapiGetCommentaryOptionsByBookId("book-1");
check("the failure was not cached — the next request gets the real options", !!r2 && r2.authors.length > 0, JSON.stringify(r2));

console.log("\nLight scan finds nothing, and the full book cannot be loaded");
mode = "light-scan-empty-book-fails";
hits.fullBook = 0;
const r3 = await strapi.strapiGetCommentaryOptionsByBookId("book-2");
check("falls back to the full book (light scan succeeded empty)", hits.fullBook > 0);
check("returns null", r3 === null, JSON.stringify(r3));
mode = "healthy";
const r4 = await strapi.strapiGetCommentaryOptionsByBookId("book-2");
check("…and did not cache 'no commentary' for that book either", !!r4 && r4.authors.length > 0, JSON.stringify(r4));

server.close();
console.log(`\n${failures === 0 ? "all passed" : `${failures} failed`}`);
process.exit(failures === 0 ? 0 : 1);
