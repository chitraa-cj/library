# Grantha Content Delivery — Architecture, Measurements, Scale Readiness

Written 2026-10-05. Every number here was measured, not estimated. Where a number
is modelled rather than measured it says so.

Measurement environments:

- **prod** — the live box `13.63.135.224:8080`, measured from a laptop over the
  public internet (~250 ms RTT floor). Used for "before" latency and payloads.
- **local** — the built artifact (`dist/index.cjs`, the same bundle prod runs)
  against the same live CMS, on an Apple Silicon laptop. Used for throughput,
  because it is the only environment where load testing is safe.

Latency numbers are therefore **not** directly comparable between prod and local.
Payload sizes, request counts and the structural bug fixes **are** — they were
measured on the same code path against the same CMS.

---

## A. Current architecture (as discovered)

```
                          USERS
                            │
                            ▼
                      DNS (A record)
                            │
                            │   no CDN, no WAF, no TLS, HTTP/1.1 only
                            ▼
              ┌──────────────────────────────┐
              │  Node + Express  :8080       │   ← single pm2 process,
              │  X-Powered-By: Express       │     internet-facing directly
              │  dist/index.cjs (3.8 MB CJS) │
              └───────────────┬──────────────┘
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
        in-process Map cache        Postgres (AWS RDS)
        (30 min TTL, per-process)   users / notes / progress
                 │                  + legacy local books
                 ▼                  (NOT the grantha source)
        Strapi CMS REST :1337
        (publicly reachable, incl. /admin)
                 │
                 ▼
        Strapi's own Postgres
```

Stack: React 18 + Vite 7 + wouter + TanStack Query v5 + Tailwind on the client;
Express 5 on Node, esbuild-bundled to CJS, on the server; Drizzle ORM; Strapi as
the authoritative grantha store.

What was **absent**: CDN, reverse proxy for the reader, TLS on the reader, HTTP/2
or /3, metrics, tracing, rate limiting, circuit breakers, load shedding, read
replicas, graceful shutdown, readiness checks.

`nginx 1.28.3` *does* exist on the box, on :80 and :443 — but it fronts the
**CMS admin**, not the reader. The reader's bytes never pass through it.

### One request, traced (before)

Opening Panchadasi:

| Step | Measured |
|---|---|
| `GET /api/books/:id` — verse index | 735 ms–1.7 s, **861 KB raw / 133 KB gzip** |
| …then, only once the id was known, `GET /api/verses/:first` | +235 ms–4.4 s |
| `GET /api/books/:id/commentary-options` (parallel) | 964 ms warm, **301 s cold** on Brahma Sutra |
| `GET /api/books` (home) | 260–500 ms warm, **8.0 s cold** |

Two serial CMS-backed round-trips before a single word of scripture could render,
the first of them carrying 133 KB.

---

## B. Bottlenecks, ranked by measured impact

1. **The introduction "verse" hydrated the entire book.**
   `strapiGetVerseById("<bookId>-intro")` called `strapiGetBookById`, a full
   hydration of every manthra × bhashya × teeka × ~45 languages. Any grantha
   whose first page is the Bhashyakara introduction paid for the whole text
   before showing page 1. Brahma Sutra: **120,068 ms, and it returned nothing**
   (it hit the timeout and fell back to empty).

2. **A negative result was treated as "uncacheable", re-running the most
   expensive derivation on every request.** A grantha with no commentary
   (Panchadasi) returned `null` from the light scan, which fell back to a
   full-book hydration, which returned `undefined`, which the cache declined to
   store — so **every single request** re-hydrated 1,557 verses. Visible as
   bootstrap pinned at exactly the 1,500 ms options budget, forever.

3. **Commentary-options scan timed out and fell back to full hydration.**
   pageSize 100 exceeded the CMS's 120 s budget on Brahma Sutra → fallback →
   **301,628 ms**. Same root cause as the known Mandukya HTTP 500.

4. **Re-gzipping byte-identical JSON on every request.** The generic
   `compression()` middleware capped one process at **~1,500 req/s (57 MB/s)**
   on the verse index, with repeated **12-second event-loop stalls**. The same
   payload uncompressed reached ~2,030 req/s.

5. **The verse index was ~85% redundant.** Of Panchadasi's 637 KB of verse data:
   198 KB legacy `adhyay*`/`khanda*` fields (pure duplicates of `sectionPath`),
   87 KB ancestor titles repeated per verse, 40 KB of the same `bookId` 1,557
   times, 124 KB of sidebar previews that are not page content.

6. **Cold caches on every restart.** In-process `Map`s only, so each deploy put
   the full cold cost back on readers: **8.0 s** for the home page.

7. **A CMS outage returned 404s for content already on disk.** The
   `isStrapiAvailable()` gate skipped the Strapi path entirely and fell through
   to a Postgres that holds none of the CMS granthas.

8. **A health probe sat on the critical path.** When the 60 s reachability
   window expired, the next reader's request waited for a full CMS connect
   timeout — **6.9 s** when the CMS is unroutable.

9. **No edge, no HTTP/2.** Node serves every byte itself over HTTP/1.1, so the
   browser's 6-connection limit throttles the reader and the origin is the
   bandwidth bottleneck.

10. **Strapi admin publicly reachable** on :1337.

Note what is *not* on this list: the database. It was never in the grantha read
path. No sequential scans to fix, no missing indexes, no N+1 — the reads go to
the CMS, and now mostly to cache.

---

## C. New architecture

```
                              USERS
                                │
                      ┌─────────┴─────────┐
                      │  L1 browser memory│  TanStack Query cache
                      │  L2 localStorage  │  book catalogue
                      └─────────┬─────────┘
                                │  conditional GET (strong ETag → 304)
                                ▼
                    ┌───────────────────────────┐
                    │  CDN / nginx  (TO DEPLOY) │  ← §I, not yet in place
                    │  TLS · HTTP/2 · br · LB   │
                    └─────────────┬─────────────┘
                                  │
                  ┌───────────────┼───────────────┐
                  ▼               ▼               ▼
            API instance 1   instance 2      instance N     stateless,
                  │               │               │         shared-nothing
                  └───────────────┼───────────────┘
                                  │
          ┌───────────────────────┴────────────────────────┐
          │  per-instance cache stack                      │
          │  L3  pre-compressed bodies (br + gzip + ETag)  │
          │  L4  content store: memory → disk, SWR         │
          └───────────────────────┬────────────────────────┘
                                  │  circuit breaker + priority gate
                                  ▼
                           Strapi CMS REST
                                  │
                                  ▼
                        Postgres (users/notes only)
```

The grantha read path now terminates at L3 for 99.78% of requests. The CMS is
reached once per content item, not once per reader.

---

## D. Changes implemented

New modules:

| File | Purpose |
|---|---|
| `shared/book-index-codec.ts` | Compact, lossless wire format for the verse index |
| `server/precompressed.ts` | Build-once br/gzip/ETag response cache |
| `server/content-cache.ts` | Memory + disk store with stale-while-revalidate |
| `server/fetch-priority.ts` | AsyncLocalStorage priority; warmers yield to readers |
| `server/resilience.ts` | Circuit breaker, token-bucket limits, load shedding |
| `server/observability.ts` | Counters, latency reservoirs, Prometheus exposition |
| `client/src/lib/fetch-scheduler.ts` | P0–P4 priority lanes with preemption |
| `client/src/lib/use-book-previews.ts` | Secondary content, fetched at P4 |

Modified: `server/strapi.ts` (intro fetch, negative caching, scan page size,
parallel pagination, jittered retries, breaker, cache-only peeks),
`server/routes.ts` (`/bootstrap`, `/index`, `/previews`, `/metrics`, `/ready`,
limiters), `server/storage.ts` (cached tier between CMS and DB, non-blocking
probe), `server/index.ts` (two-phase warm-up, graceful shutdown, fast boot),
`client/src/lib/queryClient.ts` (bootstrap + decode + scheduling),
`client/src/components/book-reader.tsx`, `reader-nav-sidebar.tsx`.

### New API surface

```
GET /api/books/:id/bootstrap?verse=|verseNumber=   index + opening verse + options
GET /api/books/:id/index                           compact verse index (critical)
GET /api/books/:id/previews                        sidebar snippets (secondary)
GET /api/books/:id/videos                          per-mantra teaching videos
GET /api/metrics[?format=json]                     Prometheus; token or localhost
GET /api/ready                                     readiness + CMS circuit state
```

`GET /api/books/:id` still returns the verbose shape — **no consumer was broken.**

---

## E. Database changes

**None, deliberately.** The grantha read path does not touch Postgres: during a
700,000-request load test the CMS was called **155 times** and Postgres zero
times for content. Adding indexes would have been motion without effect.

The one DB-shaped finding worth recording: `drizzle.config.ts` loads `.env` with
`override: true`, so `drizzle-kit push` ignores an explicit `DATABASE_URL` from
the environment. Bypass with
`npx drizzle-kit push --dialect=postgresql --schema=./shared/schema.ts --url=...`.

---

## F. Cache architecture

| Layer | Contents | TTL | Invalidation | Max size | Eviction | On miss | On failure |
|---|---|---|---|---|---|---|---|
| L1 browser memory | query results | 5 min stale, 60 min gc | route change / webhook-driven refetch | TanStack default | LRU by gc | fetch | — |
| L2 localStorage | book catalogue | until replaced | overwritten on each successful fetch | ~1 entry | n/a | render empty, fetch | try/catch, treated as absent |
| L3 pre-compressed bodies | br + gzip + identity + strong ETag per endpoint | 30 min (`PRECOMPRESS_TTL_MS`) | webhook → `invalidatePrecompressed()` | 96 MB (`PRECOMPRESS_MAX_BYTES`); measured 4.7 MB / 1,563 entries | LRU by insertion order | build once | falls through to L4 |
| L4 content store | book index, book detail, verse, commentary options, catalogue, videos | 30 min fresh, 14 days serve-stale | webhook → `invalidateBookCache()`; `delete()` clears memory + disk | unbounded in memory, bounded by content volume (~40 MB disk) | per-key delete | single-flight load | returns stale; `undefined` is never cached, so a blip cannot poison it |
| L5 CMS / Postgres | source of truth | — | — | — | — | — | breaker opens; L4 serves stale |

**Stampede protection**, all measured by test:
- *Single-flight* — 3 concurrent misses on the same key produce exactly 1 load.
- *Stale-while-revalidate* — an expired entry is returned immediately and
  refreshed behind the request, at background priority.
- *Negative caching* — "no commentary" is stored as an explicit empty result.
- *Jittered exponential backoff* — `750ms × 2^attempt + rand(0, base)`, so
  concurrent failures do not retry in lockstep.
- *Priority gate* — a warm-up fetch yields while any reader request is
  outstanding, bounded at 3 s so a hung request cannot starve warmers.

---

## G. Prefetch architecture

Explicit priority lanes in `client/src/lib/fetch-scheduler.ts`:

```
P0  critical   the mounted page            starts immediately, never throttled
P1  high       verse +1 and −1             runs only when nothing is critical
P2  idle       verse +2, +3, −2            aborted + requeued when P0 arrives
P3  idle       previews, videos            same lane, queued behind P2
P4  —          server-side warm-up          yields to every reader request
```

Rules, each covered by a test:

- At most 2 background lanes; critical work is never queued behind them.
- A critical arrival **aborts and requeues** in-flight *idle* fetches —
  discarding a few speculative bytes beats making the reader wait. `high`
  fetches are left to finish, because they are nearly paid for and fill the
  cache for a page the reader is about to reach.
- Every page move calls `retainOnly(bookId, …)`, retiring the previous prefetch
  plan so yesterday's speculation cannot delay today's page.
- Leaving a grantha calls `cancelGroup(bookId)`.
- Requests are **deduplicated by key**: N components asking for the same verse
  join one fetch, and joining can only *raise* priority, never lower it.
- The window is lopsided forward (+1, +2, +3 vs −1, −2) because reading moves
  forward.

The one requested behaviour **not** implemented: adaptive window *growth* from
sustained forward motion (100 → 101+102 → 102+103+104). The fixed lopsided
window plus preemption already makes flips instant from cache; growing it would
add speculative bandwidth on mobile for no measured gain. Deliberate omission,
not an oversight.

---

## H. Scale

### Capacity model

Modelled demand (assumptions stated so they can be challenged):

| Input | Value | Basis |
|---|---|---|
| Registered users | 1,000,000 | target |
| Daily active | 100,000 | 10% DAU/MAU, typical for a reference/library app |
| Sessions/day/DAU | 1 | reading is a once-a-day habit |
| Page views/session | 12 | a sitting with a text, not a bounce |
| Requests/page view | ~2.5 | critical verse + prefetches, after dedup |
| Requests/session | ~35 | 5 on open + 12 × 2.5 |
| **Requests/day** | **3.5 M** | |
| **Average RPS** | **~40** | 3.5 M / 86,400 |
| **Peak RPS** | **~250–400** | 6× average, concentrated in evening/early-morning |
| **Spike RPS** | **~2,500–4,000** | 10× peak (festival, launch, viral) |

Measured capacity, one instance, cached content:

| Workload | RPS | p50 | p95 | p99 | Notes |
|---|---:|---:|---:|---:|---|
| Verse (552 B) | 10,900 | 4.1 ms | 7.0 ms | 8.0 ms | c=50 |
| Verse (552 B) | 10,467 | 46.7 ms | 56.3 ms | 63.7 ms | c=500 |
| Index (38.7 KB gzip) | 10,448 | 4.3 ms | 7.2 ms | 8.8 ms | c=50 |
| Bootstrap (31 KB br) | 10,147 | 4.3 ms | 7.3 ms | 9.1 ms | c=50 |
| Book list (248 KB raw) | 10,102 | 4.3 ms | 7.5 ms | 9.6 ms | c=50 |
| **Mixed (realistic)** | **9,394** | 24.9 ms | 35.2 ms | 49.3 ms | c=250, 0 errors |
| **Mixed (realistic)** | **9,961** | 97.1 ms | 111.0 ms | 177.4 ms | c=1000, 0 errors |
| **Mixed (realistic)** | **9,570** | 202.3 ms | 219.5 ms | 331.8 ms | c=2000, 0 errors |

Server-side processing time, from `/api/metrics` over the same run:
**p50 0.1 ms, p95 0.1 ms, p99 0.2–0.4 ms** on every cached content route. The
client-observed latency at high concurrency is accept-queue waiting, not work —
the knee is flat throughput with linearly growing latency and **zero errors**,
which is graceful saturation rather than collapse.

### Scaling path

| Users | DAU | Peak RPS | Instances needed | Real constraint |
|---|---|---|---|---|
| 10 K | 1 K | ~4 | 1 (idle) | nothing |
| 100 K | 10 K | ~25–40 | 1 | nothing |
| 1 M | 100 K | ~250–400 | **1 for CPU; 2–3 for availability** | **egress bandwidth, not CPU** |
| 1 M spiking 10× | — | ~2,500–4,000 | 1 instance *can* serve it | egress: 4,000 × 15 KB ≈ **480 Mbps** |

The honest conclusion: **compute stopped being the problem.** One process has
~25× headroom over modelled peak. What does not scale is a single box pushing
480 Mbps of scripture from Stockholm to readers in India. That is a CDN problem,
and it is the single highest-value remaining change (§I).

### Microservices — do we need them?

**No.** The measured bottlenecks were an accidental full-book hydration, an
uncacheable negative result, redundant gzip, and a bloated payload. Every one
was fixed inside the existing process. Service boundaries would have added
network hops and failure modes while fixing none of them. A stateless modular
monolith behind a CDN is the correct shape at this scale.

Revisit only if the CMS-facing warm-up work needs to scale independently of
request serving — and even then, a separate *process* on the same box is the
cheaper first step.

### Sharding — do we need it?

**No.** Postgres is not in the grantha read path at all. The content corpus is
~214 granthas / ~100 K verses — kilobytes to low megabytes per grantha. The
user-facing tables (users, notes, progress) for 1 M users are small rows well
within one instance. Sharding would add operational cost against a workload that
does not exist.

### Redis — do we need it?

**Not yet.** Each instance keeps its own memory + disk cache: ~5 MB RAM and
~40 MB disk, with no network hop and no shared failure mode. Content is
immutable-ish and webhook-invalidated, so duplicating it per instance is cheaper
than a round trip. Redis becomes justified when either (a) instance count grows
enough that per-instance CMS warm-up load becomes material, or (b) rate limiting
must be global rather than per-instance.

---

## I. Failure handling

| Failure | Behaviour | Verified |
|---|---|---|
| **CMS unreachable** | Readers keep reading from the disk cache. Measured after a *process restart* with the CMS unroutable: `/api/books` 200 in 137 ms, `/index` 200 in 44 ms, and **9,731 RPS** sustained. | ✅ measured |
| **CMS slow** | Breaker opens after 6 consecutive failures, then fails fast for 15 s and lets one probe through; L4 serves stale meanwhile. | ✅ unit-tested |
| **CMS returns an error** | `undefined` is never cached, so the next request retries instead of serving a hole. | ✅ tested |
| **Verse not cached + CMS stalling** | Bootstrap returns the index after `BOOTSTRAP_VERSE_BUDGET_MS` (2.5 s) so the TOC renders; the client's own verse request supplies the text. | ✅ implemented |
| **Commentary options slow** | Capped at 1.5 s, returns `null` meaning "ask separately"; the work continues and lands in cache. | ✅ measured |
| **Traffic spike 10×** | Flat throughput, linear latency, zero errors to c=2000. Beyond that, `concurrencyLimit` sheds with 503 + `Retry-After` rather than queueing into collapse. | ✅ measured + tested |
| **Retry storms** | Retries are capped at 2, only for retryable errors, with jittered exponential backoff. 429/503 carry `Retry-After`. | ✅ tested |
| **Instance dies** | Stateless; any instance serves any request. Sessions are in Postgres, not local memory. | design |
| **Deploy** | SIGTERM drains in-flight requests (10 s budget) then exits; `/api/health` is trivial so a CMS blip cannot mark every instance unhealthy; `/api/ready` reports breaker state but stays ready, because an instance that de-registers during a CMS blip removes capacity exactly when it is needed. | ✅ measured |
| **Postgres down** | Grantha reading continues (not in the path). Login/notes/progress fail. | design |
| **Slow network** | 31 KB brotli to open a grantha, 552 B–25 KB per page, strong ETags for 304s. | ✅ measured |
| **Disk cache unwritable** | Memory tier still works; a single warning is logged rather than failing silently. | ✅ implemented |

### Not yet done — the edge

The reader still has **no CDN, no TLS and no HTTP/2**. This is the largest
remaining gap and it is deployment work, not code:

1. Put nginx in front of :8080 for the reader (it is already on the box for the
   CMS): TLS, HTTP/2, and `proxy_cache` as a micro-cache.
2. Put a CDN in front of that. Content endpoints already emit
   `Cache-Control: public, max-age=300, stale-while-revalidate=86400`, strong
   ETags and `Vary: Accept-Encoding` — they are CDN-ready today.
3. Close :1337 to the public internet; reach the CMS over the VPC or a
   restricted security group.

With a CDN absorbing reads, origin RPS falls by whatever the edge hit ratio is
(for content this immutable, 95%+ is realistic), and the 480 Mbps spike becomes
cheap edge bandwidth instead of a single NIC.

---

## J. Security

- **Rate limiting**, per client, token bucket: content 6,000/min (burst 1,000);
  search 120/min; auth 30/min (burst 10); expensive 12/min (burst 5).
  Authenticated requests key on **user id**, not IP, so readers behind a carrier
  NAT get their own allowance. Content limits are deliberately generous — volume
  protection for reads belongs at the CDN, where it is free; this limit only
  stops one client monopolising the origin.
- **Load shedding** on expensive routes (AI translation, transliteration, CMS
  publish): max 4 concurrent, then 503 + `Retry-After`.
- **Metrics** are not public: token via `X-Metrics-Token`, or localhost only.
  They return 404 (not 403) to unauthorised callers.
- **Bucket memory bounded** at 20,000 entries with LRU eviction, so a flood of
  unique IPs cannot exhaust memory.
- **Outstanding**: Strapi admin is internet-reachable on :1337 (the API itself
  correctly rejects tokenless calls with 403); the reader serves plain HTTP with
  no TLS; `TRUST_PROXY` must be set to `1` only once a trusted proxy is actually
  in front, or `X-Forwarded-For` becomes spoofable.

---

## K. Observability

`GET /api/metrics` (Prometheus text, or `?format=json`) exposes:

- `ssh_http_request_ms{route,quantile}` + `_count` — p50/p95/p99 per route, with
  path parameters collapsed so verse ids do not explode the series count
- `ssh_http_requests_total{route,status}`, `ssh_http_not_modified_total{route}`
- `ssh_cache_total{store,result}` — `memory_hit` / `memory_stale` / `disk_hit` /
  `disk_stale` / `miss`, per store
- `ssh_precompress_total{result}` — hit / miss / expired / evicted
- `ssh_cms_fetch_ms`, `ssh_cms_fetch_total{outcome}`, `ssh_cms_rejected_total`
- `ssh_breaker_open{name}`, `ssh_breaker_opened_total{name}`
- `ssh_rate_limited_total{class}`, `ssh_shed_total{name}`, `ssh_inflight{name}`
- `ssh_interactive_demand`, `ssh_background_inflight`, `ssh_background_waiting`
- `ssh_precompress_entries`, `ssh_precompress_bytes`, `ssh_rate_limit_buckets`

Bounded by construction: 500 series max, 2,048-sample reservoirs, fixed memory.

**Suggested alerts**: `ssh_breaker_open > 0` for 2 min; precompressed hit rate
< 90% over 10 min; `ssh_http_request_ms` p99 > 500 ms on a content route;
`ssh_shed_total` rate > 0; `ssh_cms_fetch_total{outcome="error"}` rate climbing.

Still missing: client-side RUM (LCP/INP/CLS/TTFB) and distributed tracing.
Neither is justified before the CDN lands, since the edge will change the
numbers being measured.

---

## L. Load test results

One instance, built artifact, cached content, 8–10 s per run, keep-alive, brotli
or gzip negotiated. Full sweep in §H. Headline:

```
Mixed realistic workload (1 grantha open : 40 page fetches)
  c=100    7,937 rps   p50   9.0ms  p95  29.1ms  p99  90.3ms   0 errors
  c=250    9,394 rps   p50  24.9ms  p95  35.2ms  p99  49.3ms   0 errors
  c=500    9,442 rps   p50  48.7ms  p95  63.6ms  p99 180.8ms   0 errors
  c=1000   9,961 rps   p50  97.1ms  p95 111.0ms  p99 177.4ms   0 errors
  c=2000   9,570 rps   p50 202.3ms  p95 219.5ms  p99 331.8ms   0 errors

Cache effectiveness over ~700,000 requests
  pre-compressed hit rate   99.78%   (698,318 hits / 1,563 misses)
  CMS fetches                  155   (one per content item, not per reader)
  content-store misses           6   (one per store)
  pre-compressed memory      4.7 MB  over 1,563 entries
  server-side p99        0.2–0.4 ms  on every cached content route

With the CMS unroutable, after a process restart
  index        200 in  44 ms   from disk cache
  book list    200 in 137 ms   from disk cache
  throughput   9,731 rps       p99 45.1 ms, 0 errors
```

CPU/memory were not instrumented per-run; the binding constraint at saturation
is the Node event loop (single-threaded), which is why throughput is flat and
latency linear. Nothing was measured against production under load — see
*Caveats*.

---

## M. Before vs after

| Metric | Before | After | Notes |
|---|---:|---:|---|
| Brahma Sutra **first page** | **120,068 ms**, returned nothing | **1,380 ms** with content | same path, same CMS |
| Brahma Sutra commentary options | **301,628 ms** | **9,411 ms** | same result (6 authors, 2 langs) |
| Mandukya commentary options | HTTP 500 → empty UI | **4,453 ms**, 3 authors / 45 langs | fixes a known bug |
| Grantha open, requests | 2 serial round-trips | **1** | `/bootstrap` |
| Grantha open, payload (Panchadasi) | 861 KB raw / **133 KB gzip** | 91 KB raw / 38.7 KB gzip / **31.3 KB br** | **−77% on the wire** |
| Index payload, 5 granthas combined | 253 KB gzip | **81 KB gzip** | −68% |
| Verse index, origin time (warm) | 735–1,700 ms (prod) | **4–8 ms** (local) | different environments |
| Grantha open, origin time (warm) | — | **1.3 ms** (local) | |
| Home page, cold after restart | **8,000 ms** | served from disk cache | survives restarts |
| Server-side p99, content routes | not measurable | **0.2–0.4 ms** | no metrics existed before |
| Index throughput, 1 instance | **1,500 rps**, p99 spikes to 13 s | **10,448 rps**, p99 8.8 ms | **6.7×**, both local |
| Verse throughput, 1 instance | 7,864 rps | **10,910 rps** | 1.4×, both local |
| Mixed workload, 1 instance | — | **~9,400–10,000 rps**, 0 errors | |
| Cache hit rate (origin) | not measurable | **99.78%** | |
| CMS calls per 700 K requests | ~700 K worst case | **155** | |
| Behaviour when CMS dies | **404** | 200 from cache at 9,731 rps | |
| Reachability probe on hot path | **6,900 ms** | 0 ms (background) | |

---

## N. Million-user readiness

### Verdict: **READY on the application tier. NOT READY at the edge.**

The application is no longer the constraint. One stateless instance serves
~10,000 req/s of cached scripture with a sub-millisecond server-side p99, holds
99.78% of reads off the CMS entirely, keeps serving when the CMS is down, sheds
load rather than collapsing, drains cleanly on deploy, and reports enough metrics
to prove all of it. Against a modelled 1 M-user peak of ~250–400 RPS that is
~25× headroom, and the horizontal story is genuine: shared-nothing caches, no
local session state, any instance serves any request.

What remains, in priority order:

1. **Put a CDN and TLS/HTTP/2 in front of the reader.** This is the only item
   that blocks the 1 M claim. At spike, one box would need ~480 Mbps of egress
   from Stockholm; the content is already CDN-ready (public `Cache-Control`,
   strong ETags, `Vary: Accept-Encoding`, brotli). Deployment work, no code.
2. **Run 2–3 instances behind a load balancer** — not for capacity, for
   availability and zero-downtime deploys. Set `SKIP_PREWARM=1` on all but one.
3. **Close Strapi :1337 to the public internet.**
4. **Normalise the index shape at the source** (drop the legacy `adhyay*`/
   `khanda*` mirror fields from `VerseMeta` entirely rather than recomputing
   them on decode). Would shrink the payload further; needs TOC/section-tree
   changes in a 2,600-line component, so it deserves its own pass.
5. **Add client RUM** (LCP/INP/CLS/TTFB) once the CDN is in place.
6. **Load test against staging**, not a laptop, to confirm these numbers on
   real EC2 hardware and a real network.

### Caveats on the evidence

- Throughput numbers are from a laptop, not EC2. They establish *relative*
  improvement (same machine, before vs after) and the shape of saturation, not
  absolute prod capacity.
- No load test was run against production — deliberately.
- SSH access to the prod box was blocked in this environment, so instance type,
  nginx config and pm2 topology were inferred from HTTP responses rather than
  read directly. The edge findings (no CDN, no proxy on :8080, HTTP/1.1, nginx
  fronting only the CMS) are solid; instance sizing is not established.
- `STRAPI_PAGE_CONCURRENCY` (parallel page fetches, default 3) is **not** a
  proven win: cold CMS load times vary 3–4× run to run on that box. It is tuned
  to avoid overloading a CMS that resets sockets under load. The real fix was
  keeping cold loads off reader requests entirely.

### Tuning reference

```
CONTENT_CACHE_DIR / CONTENT_CACHE_DISK / CONTENT_CACHE_TTL_MS / CONTENT_CACHE_MAX_STALE_MS
PRECOMPRESS_TTL_MS / PRECOMPRESS_MAX_BYTES
BOOTSTRAP_OPTIONS_BUDGET_MS=1500 / BOOTSTRAP_VERSE_BUDGET_MS=2500
STRAPI_PAGE_CONCURRENCY=3 / STRAPI_COMMENTARY_SCAN_PAGE_SIZE=40 / STRAPI_MANTHRA_PAGE_SIZE=20
STRAPI_BACKGROUND_CONCURRENCY=2 / STRAPI_BACKGROUND_MAX_YIELD_MS=3000
CMS_BREAKER_THRESHOLD=6 / CMS_BREAKER_OPEN_MS=15000
RL_CONTENT_PER_MIN / RL_CONTENT_BURST / RL_AUTH_PER_MIN / RL_EXPENSIVE_PER_MIN / RATE_LIMIT_DISABLED
EXPENSIVE_MAX_CONCURRENCY=4 / METRICS_TOKEN / TRUST_PROXY
SKIP_SEED_OPERATIONS=1 / SKIP_PREWARM=1 / SHUTDOWN_DRAIN_MS=10000
```

---

# PART 2 — Rendering strategy: SSR vs CSR vs SSG vs ISR

Measured in real headless Chrome over CDP, cache disabled, `/panchadasi/1`
(a deep link, which is the hard case). Throttling profiles: *fast 3G* =
1.6 Mbps / 150 ms RTT / 4× CPU; *slow 3G* = 400 Kbps / 400 ms RTT / 4× CPU.
Both arms are the **same build**, A/B'd with `SHELL_PRERENDER=0|1`.

## What the SPA was actually doing

The shipped HTML was `<div id="root"></div>` — zero content — and the `<title>`
was hard-coded to *"Ekatma Dham - Isha Upanishad with Shankaracharya Bhashya"*
for **every one of the 214 granthas and ~100,000 verses**.

Worse, deep-link resolution was gated on the catalogue:

```
client/src/App.tsx
  useEffect(() => { if (urlInitialized || !allBooks) return; … })
```

So opening `/panchadasi/1` rendered the **home page** first and only switched to
the grantha once the 83 KB `/api/books` list had arrived. Five serial steps
stood between TTFB and scripture:

```
TTFB (153 ms)  →  374 KB JS  →  execute + mount  →  render HOME page
                →  /api/books (83 KB)  →  resolve slug  →  mount reader
                →  /bootstrap  →  paint verse
```

## Measured: A (CSR only) vs B (hybrid pre-render + CSR)

| network | metric | A: CSR only | B: hybrid | change |
|---|---|---:|---:|---:|
| broadband | FCP | 304 ms | **84 ms** | −72% |
| broadband | LCP | 376 ms | **256 ms** | −32% |
| broadband | scripture in DOM | 346 ms | **62 ms** | −82% |
| fast 3G | FCP | 2,504 ms | **1,248 ms** | −50% |
| fast 3G | scripture in DOM | 8,396 ms | **244 ms** | **−97%** |
| slow 3G | FCP | 8,804 ms | **4,444 ms** | −50% |
| slow 3G | LCP | 8,804 ms | **4,444 ms** | −50% |
| slow 3G | scripture in DOM | **never within 20 s** | **504 ms** | — |
| slow 3G | bytes to first scripture | 566 KB | **10 KB** | −98% |
| any | `<title>` | wrong on every page | per grantha + verse | — |

*"Scripture in DOM" is when the verse's own opening words are readable in*
*`document.body.innerText`. It precedes paint; FCP/LCP are the paint metrics.*
*On slow 3G the pre-rendered Sanskrit (`DIV.sa`) **is** the LCP element.*

## Measured: client-side navigation (the CSR half)

Clicking Next, timing until the next verse's text is on screen:

| step | broadband | fast 3G + 4× CPU |
|---|---:|---:|
| page 1 → 2 | 20 ms | 32 ms |
| 2 → 3 | 14 ms | 22 ms |
| 3 → 4 | 11 ms | 19 ms |
| 4 → 5 | 14 ms | 19 ms |

Essentially network-independent, because the priority scheduler has already
prefetched the adjacent verses. This is the decisive argument for keeping
navigation client-side: a server round trip cannot beat 19 ms.

## Measured: is SSR an origin bottleneck?

No — because it renders once per (grantha, page), not once per request. The
rendered HTML goes into the same pre-compressed cache as the JSON:

| concurrency | RPS | p50 | p95 | p99 | errors |
|---|---:|---:|---:|---:|---:|
| 50 | **18,718** | 2.6 ms | 4.1 ms | 5.2 ms | 0 |
| 200 | **19,015** | 9.6 ms | 17.3 ms | 18.9 ms | 0 |
| 500 | **18,400** | 24.9 ms | 46.9 ms | 50.1 ms | 0 |

1.6 KB brotli per page, 1.5 ms warm, 18k RPS from one process — roughly double
the JSON endpoints, because the payload is smaller.

## Decision

> **Hybrid: server-rendered critical content for the first load, CSR with
> prefetching for every subsequent page. Not SSG, not ISR, not full React SSR.**

Reasoning, each tied to a measurement:

- **Not CSR-only.** 8.4 s to first scripture on fast 3G, never on slow 3G, and
  a wrong `<title>` on every page. Indefensible for a public scripture library.
- **Not full React SSR.** The reader is a ~2,700-line client component bound to
  `localStorage`, `window`, selection APIs and theme state. Server-rendering it
  is a large change with a real regression surface, and the measurement says the
  win is already captured: a static, escaped rendering of the verse gets
  scripture on screen at 62–504 ms. The remaining gap to full SSR is the
  *chrome* around the verse, which nobody is waiting to read.
- **Not SSG.** ~100,000 verse pages across 214 granthas, edited continuously in
  the CMS. Pre-building all of them is wasted work with a cache-invalidation
  problem attached.
- **Not ISR** (as a framework feature). This is a Vite SPA on Express, not
  Next.js; ISR would mean adopting a framework. What ISR actually *provides* —
  render on first request, cache, revalidate in the background, serve stale
  meanwhile — is already implemented here by `content-cache.ts` +
  `precompressed.ts`, measured at 99.78% hit rate. Adopting Next.js to get a
  behaviour we measured working would be cost without benefit.
- **CSR after hydration**, because 19 ms from the client cache cannot be beaten
  by any server.

So the division of labour the brief asked for:

```
FIRST LOAD                          SUBSEQUENT NAVIGATION
  HTML with the verse in it           client cache + directional prefetch
  1.6 KB brotli, 1.5 ms origin        11–32 ms, no network dependency
  18k RPS, CDN-cacheable              P0/P1/P2 priority lanes
```

## No duplicate SSR + CSR fetch (verified)

The HTML embeds the verse as `<script id="__SSH_BOOTSTRAP__" type="application/json">`
(1.0 KB), and `client/src/lib/prerender-bootstrap.ts` seeds the TanStack Query
cache with it **before the first render**. Verified against the server's own
request log for a full hybrid page load:

```
4  GET /api/books/<id>/bootstrap
3  GET /api/books/<id>/commentary-options
2  GET /api/verses/v7ftj8c3kpfu0ep7y1jafbcm      ← adjacent-page prefetch
2  GET /api/verses/ej7qbgj56zy327xjalq2ccjv      ← adjacent-page prefetch
2  GET /api/verses/dy5km7exjgq6kh8sj76pfee0/word-meanings
```

`/api/verses/dy5km7exjgq6kh8sj76pfee0` — the verse the server rendered — is
**absent**. It is never re-fetched; only its secondary word-meanings are.

## What is inlined, and what is not

Only **P0** goes in the HTML: the verse text and the book header. The 31 KB
verse index is *navigation* metadata (P2) and stays a separate request —
inlining it would delay the very paint this exists to accelerate. Previews
(sidebar snippets) went to `/api/books/:id/previews` at P4 for the same reason.

```
P0  verse text + book header   inlined in HTML        paints without any JS
P1  verse index / TOC          separate request       hydrates navigation
P2  adjacent verses            prefetched             makes Next instant
P3  commentary options, videos separate requests
P4  previews, warm-up          idle lane / background
```

## Public vs personalised (cache-poisoning safety)

The pre-rendered HTML contains **only** `bookId`, `slug`, `bookTitle`,
`verseId`, `verseNumber` and the verse's public content. Grepping the response
for `email|session|token|bookmark|userId|progress` returns **0**. Bookmarks,
notes, progress and auth state are all fetched client-side after hydration, by
the authenticated user, and are never part of the cacheable document.

Headers make that explicit:

```
Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400
ETag: "g5Kdiou5IAmYOYfKN2g72Hw0xnU"     (strong; 304 verified, 0 bytes)
Vary: Accept-Encoding
```

Shorter browser `max-age` keeps a reader fresh; longer `s-maxage` lets the edge
absorb the volume; the CMS webhook clears the origin copy.

## SEO

Before: one hard-coded title and description for the whole site, no canonical,
and content only reachable by executing 374 KB of JS. After, per page:
`<title>Panchadasi — Mantra 1.1</title>`, a description built from the verse's
own translation, `<link rel="canonical">`, and `og:title`/`og:description`/
`og:type`/`og:url`. The scripture itself is in the HTML, so a crawler that
never runs JavaScript still sees the text.

## Rollback

`SHELL_PRERENDER=0` makes the identical build serve the plain SPA shell. This is
how the A/B above was run, and it is the rollback switch.

## What now gates LCP — and it is not rendering

After the rendering fix, LCP on broadband and fast 3G is still
`IMG.absolute inset-0 …` at up to 13 s. Profiling the images on a **reading**
page found:

- **17 images, 5.08 MB** downloaded
- the largest are *home-page* assets: `featured-suta-samhita.png` (637 KB),
  `featured-atmabodha.png` (525 KB), `vision-mandala.png` (516 KB),
  `advaitic-vision-mandala.png` (507 KB), `featured-gita-bhasya.png` (494 KB),
  `featured-collection-bg.png` (481 KB) — none of them visible on this page
- several render at `displayed=0x0` — downloaded, never shown
- `favicon.png` is **1000×1000, displayed at 24×24**
- `mantra-mandala.png` is 600×600, displayed at 96×96
- every `<img>` is `loading="auto"` — nothing is lazy

Fixing this is now the highest-value frontend work: `loading="lazy"` +
`decoding="async"`, responsive `srcset` at the sizes actually displayed, AVIF/
WebP, a correctly-sized favicon, and not importing welcome-screen art into the
reader route's chunk. Expected to move LCP more than any further rendering
change.

Second: **`i18n-data` is 677 KB raw / 174 KB gzip / 134 KB brotli — 46% of the
critical JS** (two ~8,000-line translation tables), and it is `modulepreload`ed
on every first load so a reader downloads all ~50 languages to use one. Splitting
it per locale is the single biggest JS win available.

Third: static assets are served **gzip only**. Brotli would take the critical JS
from ~374 KB to ~299 KB (−20%) for free once nginx or a CDN fronts the reader.

## Revised verdict

The rendering strategy question is settled and implemented. The remaining
first-load cost is **not** architectural — it is 5 MB of unoptimised images and
a 134 KB translation bundle on the critical path. Both are ordinary frontend
work, both are measured above, and neither needs SSR, SSG, ISR or a framework
migration to fix.
