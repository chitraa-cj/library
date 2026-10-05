/**
 * Failure isolation for the content path: circuit breaking, rate limiting and
 * load shedding.
 *
 * The reader's only hard dependency for scripture is the CMS, and the CMS is the
 * slowest, least reliable component in the system (measured: 120s timeouts,
 * intermittent socket resets under load). Without a breaker, a CMS stall turns
 * into every request holding a connection for two minutes, which is how a slow
 * dependency becomes an outage.
 *
 * All state is in-process and bounded. With N app instances the effective rate
 * limit is N x these numbers — deliberately, because the alternative (a shared
 * limiter in Redis) adds a dependency to the critical path to solve a problem
 * that belongs at the CDN/WAF layer. See the deployment notes.
 */
import type { Request, Response, NextFunction } from "express";
import { incr, setGauge } from "./observability";

// ---------------------------------------------------------------- circuit breaker

type BreakerState = "closed" | "open" | "half-open";

export interface CircuitBreaker {
  /** True when calls should fail fast instead of being attempted. */
  shouldReject(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
  state(): BreakerState;
}

export function createCircuitBreaker(
  name: string,
  options: { failureThreshold?: number; openMs?: number } = {},
): CircuitBreaker {
  const failureThreshold = Math.max(1, options.failureThreshold ?? Number(process.env.CMS_BREAKER_THRESHOLD || 6));
  // The floor guards against a nonsensical env value; an explicit option from a
  // caller (notably a test) is respected as given.
  const openMs =
    options.openMs ?? Math.max(1000, Number(process.env.CMS_BREAKER_OPEN_MS || 15000));

  let consecutiveFailures = 0;
  let openedAt = 0;
  let probeInFlight = false;

  const breaker: CircuitBreaker = {
    state() {
      if (openedAt === 0) return "closed";
      if (Date.now() - openedAt >= openMs) return "half-open";
      return "open";
    },
    shouldReject() {
      const state = breaker.state();
      if (state === "closed") return false;
      if (state === "open") return true;
      // half-open: let exactly one request through to test the water.
      if (probeInFlight) return true;
      probeInFlight = true;
      return false;
    },
    recordSuccess() {
      if (openedAt !== 0) {
        console.log(`[resilience] circuit "${name}" closed after a successful probe`);
        incr("ssh_breaker_closed_total", { name });
      }
      consecutiveFailures = 0;
      openedAt = 0;
      probeInFlight = false;
    },
    recordFailure() {
      probeInFlight = false;
      consecutiveFailures++;
      if (consecutiveFailures >= failureThreshold && openedAt === 0) {
        openedAt = Date.now();
        console.warn(
          `[resilience] circuit "${name}" OPEN after ${consecutiveFailures} consecutive failures; serving cached content for ${openMs}ms`,
        );
        incr("ssh_breaker_opened_total", { name });
      } else if (openedAt !== 0) {
        // A failed probe re-opens the window.
        openedAt = Date.now();
      }
    },
  };

  setGauge("ssh_breaker_open", () => (breaker.state() === "open" ? 1 : 0), { name });
  return breaker;
}

export class CircuitOpenError extends Error {
  readonly circuitOpen = true;
  constructor(name: string) {
    super(`Circuit "${name}" is open — upstream is failing, serving cached content instead`);
    this.name = "CircuitOpenError";
  }
}

// ------------------------------------------------------------------ rate limiting

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface RateLimitClass {
  name: string;
  /** Sustained requests per minute. */
  perMinute: number;
  /** Burst allowance (bucket capacity). */
  burst: number;
}

/**
 * Reading is the critical path and is cache-friendly, so it gets a limit that a
 * real reader could never hit (a fast page-flip burst with prefetching is maybe
 * 10 requests/second for a few seconds). Expensive write-ish work is tight.
 */
export const RATE_LIMITS: Record<string, RateLimitClass> = {
  // Generous on purpose. Mobile carriers and institutions put thousands of
  // readers behind one IP, so an aggressive content limit would block real
  // users long before it blocked an abuser. Volume protection for reads belongs
  // at the CDN (where it is free); this limit exists only to stop a single
  // client from monopolising the origin.
  content: { name: "content", perMinute: Number(process.env.RL_CONTENT_PER_MIN || 6000), burst: Number(process.env.RL_CONTENT_BURST || 1000) },
  search: { name: "search", perMinute: Number(process.env.RL_SEARCH_PER_MIN || 120), burst: 40 },
  auth: { name: "auth", perMinute: Number(process.env.RL_AUTH_PER_MIN || 30), burst: 10 },
  expensive: { name: "expensive", perMinute: Number(process.env.RL_EXPENSIVE_PER_MIN || 12), burst: 5 },
};

/** Bounded LRU of buckets, so a flood of unique IPs can't exhaust memory. */
const MAX_BUCKETS = Number(process.env.RL_MAX_BUCKETS || 20000);
const buckets = new Map<string, Bucket>();

function takeToken(key: string, limit: RateLimitClass): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (bucket) {
    // Refresh LRU position.
    buckets.delete(key);
  } else {
    bucket = { tokens: limit.burst, updatedAt: now };
  }
  const refill = ((now - bucket.updatedAt) / 60000) * limit.perMinute;
  bucket.tokens = Math.min(limit.burst, bucket.tokens + refill);
  bucket.updatedAt = now;

  let allowed = true;
  if (bucket.tokens >= 1) bucket.tokens -= 1;
  else allowed = false;

  buckets.set(key, bucket);
  if (buckets.size > MAX_BUCKETS) {
    // Map iteration order is insertion order, so the first key is the coldest.
    const oldest = buckets.keys().next();
    if (!oldest.done) buckets.delete(oldest.value);
  }
  return allowed;
}

/**
 * Client identity for limiting. An authenticated user is keyed by user id, so
 * that signed-in readers sharing a NAT gateway get their own allowance instead
 * of competing for one IP's budget.
 */
export function clientKey(req: Request): string {
  const session = (req as { session?: { emailUserId?: string } }).session;
  const claims = (req as { user?: { claims?: { sub?: string } } }).user?.claims;
  const userId = session?.emailUserId ?? claims?.sub;
  if (userId) return `u:${userId}`;

  const trustProxy = process.env.TRUST_PROXY === "1";
  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    const first = (typeof forwarded === "string" ? forwarded : forwarded?.[0])?.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function rateLimit(limit: RateLimitClass) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.RATE_LIMIT_DISABLED === "1") return next();
    const key = `${limit.name}:${clientKey(req)}`;
    if (takeToken(key, limit)) return next();
    incr("ssh_rate_limited_total", { class: limit.name });
    res.setHeader("Retry-After", "2");
    res.status(429).json({ error: "Too many requests", retryAfterSeconds: 2 });
  };
}

// ------------------------------------------------------------------ load shedding

/**
 * Caps concurrent in-flight requests for a class of work and sheds the excess
 * rather than letting the queue grow until everything times out. Shedding fast
 * with a 503 is what stops a spike turning into a retry storm.
 */
export function concurrencyLimit(options: { name: string; max: number; retryAfterSeconds?: number }) {
  let inFlight = 0;
  setGauge("ssh_inflight", () => inFlight, { name: options.name });
  return (req: Request, res: Response, next: NextFunction) => {
    if (inFlight >= options.max) {
      incr("ssh_shed_total", { name: options.name });
      res.setHeader("Retry-After", String(options.retryAfterSeconds ?? 1));
      res.status(503).json({ error: "Server busy, retry shortly" });
      return;
    }
    inFlight++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      inFlight--;
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  };
}

export function rateLimiterStats(): { buckets: number } {
  return { buckets: buckets.size };
}
