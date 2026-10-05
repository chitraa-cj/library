/**
 * Request priority for outbound CMS traffic.
 *
 * The reader and the background warmers pull from the same Strapi box, which
 * only sustains a handful of concurrent heavy queries. Without a gate, a warm-up
 * pass (or a full-book hydration kicked off by one visitor) saturates Strapi and
 * every *interactive* request queues behind it — the "grantha opens slowly"
 * symptom, even when the data itself is cheap to fetch.
 *
 * So: user-facing requests run unthrottled, and background work only takes a
 * slot while no user request is outstanding. Priority is carried implicitly via
 * AsyncLocalStorage, so existing call sites don't have to thread a flag through
 * every layer.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type FetchPriority = "interactive" | "background";

const priorityStore = new AsyncLocalStorage<FetchPriority>();

/** How many background CMS fetches may run at once when nothing is waiting. */
const BACKGROUND_CONCURRENCY = Math.max(
  1,
  Math.min(4, Number(process.env.STRAPI_BACKGROUND_CONCURRENCY || 2)),
);

/**
 * Upper bound on how long background work yields. Without it, one slow
 * user-facing request (the CMS allows up to 120s) would stall every warmer, and
 * a request that never settles would stall them forever.
 */
const MAX_YIELD_MS = Math.max(
  0,
  Number(process.env.STRAPI_BACKGROUND_MAX_YIELD_MS || 3000),
);

/**
 * Outstanding user-facing requests. Counted at the HTTP-handler boundary rather
 * than at the socket, so a reader waiting on an already-in-flight (deduped)
 * fetch still suppresses background work.
 */
let interactiveDemand = 0;
let backgroundInFlight = 0;

type Waiter = { release: () => void; timer?: NodeJS.Timeout };
const waiting: Waiter[] = [];

function canStartBackground(): boolean {
  return interactiveDemand === 0 && backgroundInFlight < BACKGROUND_CONCURRENCY;
}

function drain(): void {
  while (waiting.length > 0 && canStartBackground()) {
    const next = waiting.shift();
    if (!next) break;
    if (next.timer) clearTimeout(next.timer);
    next.release();
  }
}

function acquireBackgroundSlot(): Promise<void> {
  if (canStartBackground()) {
    backgroundInFlight++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const waiter: Waiter = {
      release: () => {
        backgroundInFlight++;
        resolve();
      },
    };
    if (MAX_YIELD_MS > 0) {
      waiter.timer = setTimeout(() => {
        const idx = waiting.indexOf(waiter);
        if (idx >= 0) waiting.splice(idx, 1);
        backgroundInFlight++;
        resolve();
      }, MAX_YIELD_MS);
      // Don't hold the event loop open just to un-pause a warmer.
      waiter.timer.unref?.();
    }
    waiting.push(waiter);
  });
}

/** Marks `fn` (and everything it awaits) as serving a live user request. */
export function runInteractive<T>(fn: () => Promise<T>): Promise<T> {
  interactiveDemand++;
  let settled = false;
  const done = () => {
    if (settled) return;
    settled = true;
    interactiveDemand--;
    drain();
  };
  try {
    return priorityStore.run("interactive", fn).then(
      (value) => {
        done();
        return value;
      },
      (err) => {
        done();
        throw err;
      },
    );
  } catch (err) {
    done();
    throw err;
  }
}

/** Marks `fn` as deferrable work that should yield to live user requests. */
export function runBackground<T>(fn: () => Promise<T>): Promise<T> {
  return priorityStore.run("background", fn);
}

export function currentPriority(): FetchPriority {
  // Default to interactive: an un-annotated caller is more likely to be serving
  // a user than warming a cache, and mislabelling a warmer is cheaper than
  // throttling a reader.
  return priorityStore.getStore() ?? "interactive";
}

/**
 * Runs one outbound CMS fetch under the current priority. Interactive callers
 * pass straight through; background callers wait for a quiet moment.
 */
export async function withFetchSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (currentPriority() === "interactive") return fn();
  await acquireBackgroundSlot();
  try {
    return await fn();
  } finally {
    backgroundInFlight--;
    drain();
  }
}

export function fetchPriorityStats(): {
  interactiveDemand: number;
  backgroundInFlight: number;
  backgroundWaiting: number;
} {
  return {
    interactiveDemand,
    backgroundInFlight,
    backgroundWaiting: waiting.length,
  };
}
