/**
 * Priority scheduler for content fetches.
 *
 * The reader speculatively warms neighbouring verses so page flips feel
 * instant. Without a scheduler those speculative fetches compete with the verse
 * the reader is actually staring at: the browser allows only a handful of
 * concurrent requests per origin, so a queue of prefetches can push the one
 * request that matters behind several hundred milliseconds of work nobody is
 * waiting for.
 *
 * The rules:
 *  - `critical` — a mounted view is blocked on it. Starts immediately.
 *  - `high`     — likely next (the adjacent page). Runs only when nothing is
 *                 critical, max `BACKGROUND_LANES` at a time.
 *  - `idle`     — speculative, further out. Same lanes as `high` but yields to
 *                 it, and is *aborted and requeued* when critical work arrives,
 *                 because discarding a few partial speculative bytes is cheaper
 *                 than making the reader wait.
 *
 * Tasks are keyed, so asking twice for the same thing joins one fetch. They are
 * also grouped (by grantha), so leaving a text drops everything still queued
 * for it instead of letting it delay the text just opened.
 */

export type Priority = "critical" | "high" | "idle";

/** Browsers cap concurrent requests per origin (~6 on HTTP/1.1). */
const BACKGROUND_LANES = 2;

const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, idle: 2 };

interface Task {
  key: string;
  group: string;
  priority: Priority;
  /** Monotonic, so equal priorities keep FIFO order. */
  seq: number;
  /** Speculative work the planner may retire wholesale — see `retainOnly`. */
  speculative: boolean;
  run: (signal: AbortSignal) => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
  controller: AbortController | null;
  /** Set when we aborted it ourselves to free a lane; such a task is retried. */
  preempted: boolean;
}

export class AbortedError extends Error {
  constructor() {
    super("fetch aborted");
    this.name = "AbortedError";
  }
}

let seqCounter = 0;

const queued = new Map<string, Task>();
const running = new Map<string, Task>();

function criticalRunning(): number {
  let n = 0;
  running.forEach((t) => {
    if (t.priority === "critical") n++;
  });
  return n;
}

function backgroundRunning(): number {
  let n = 0;
  running.forEach((t) => {
    if (t.priority !== "critical") n++;
  });
  return n;
}

function nextQueued(allow: (t: Task) => boolean): Task | undefined {
  let best: Task | undefined;
  queued.forEach((t) => {
    if (!allow(t)) return;
    if (
      !best ||
      PRIORITY_RANK[t.priority] < PRIORITY_RANK[best.priority] ||
      (t.priority === best.priority && t.seq < best.seq)
    ) {
      best = t;
    }
  });
  return best;
}

function start(task: Task): void {
  queued.delete(task.key);
  running.set(task.key, task);
  const controller = new AbortController();
  task.controller = controller;

  task.run(controller.signal).then(
    (value) => {
      running.delete(task.key);
      task.resolve(value);
      pump();
    },
    (err) => {
      running.delete(task.key);
      if (task.preempted) {
        // We cut it short to make room; put it back rather than failing the
        // caller, who is still waiting on the same promise.
        task.preempted = false;
        task.controller = null;
        task.priority = "idle";
        task.seq = ++seqCounter;
        queued.set(task.key, task);
      } else {
        task.reject(err);
      }
      pump();
    },
  );
}

/** Frees lanes for critical work by cutting short purely speculative fetches. */
function preemptIdleRunning(): void {
  running.forEach((t) => {
    if (t.priority === "idle" && t.controller && !t.preempted) {
      t.preempted = true;
      t.controller.abort();
    }
  });
}

let pumpScheduled = false;
function pump(): void {
  if (pumpScheduled) return;
  pumpScheduled = true;
  // Coalesce the burst of enqueues a render produces into one scheduling pass.
  Promise.resolve().then(() => {
    pumpScheduled = false;
    runPump();
  });
}

function runPump(): void {
  // Critical work is never throttled — it is what someone is looking at.
  let critical = nextQueued((t) => t.priority === "critical");
  if (critical) preemptIdleRunning();
  while (critical) {
    start(critical);
    critical = nextQueued((t) => t.priority === "critical");
  }

  // Background work waits for a quiet moment.
  if (criticalRunning() > 0) return;
  while (backgroundRunning() < BACKGROUND_LANES) {
    const next = nextQueued((t) => t.priority !== "critical");
    if (!next) return;
    start(next);
  }
}

export interface ScheduleOptions {
  key: string;
  /** Cancellation scope, e.g. the grantha id. */
  group?: string;
  priority?: Priority;
  /** True for guesses about what the reader will want next, which `retainOnly`
   *  is free to abandon. Content someone has actually asked for must not set it. */
  speculative?: boolean;
  run: (signal: AbortSignal) => Promise<unknown>;
}

export function schedule<T>(options: ScheduleOptions): Promise<T> {
  const { key, group = "default", priority = "critical", speculative = false, run } = options;

  const existing = running.get(key) ?? queued.get(key);
  if (existing) {
    // Joining an existing task can only raise its priority, never lower it.
    if (PRIORITY_RANK[priority] < PRIORITY_RANK[existing.priority]) {
      existing.priority = priority;
      if (queued.has(key)) pump();
    }
    return new Promise<T>((resolve, reject) => {
      const prevResolve = existing.resolve;
      const prevReject = existing.reject;
      existing.resolve = (v) => {
        prevResolve(v);
        resolve(v as T);
      };
      existing.reject = (e) => {
        prevReject(e);
        reject(e);
      };
    });
  }

  return new Promise<T>((resolve, reject) => {
    queued.set(key, {
      key,
      group,
      priority,
      seq: ++seqCounter,
      speculative,
      run,
      resolve: resolve as (v: unknown) => void,
      reject,
      controller: null,
      preempted: false,
    });
    pump();
  });
}

/** Lowers a queued task's priority. In-flight work is left alone — the bytes
 *  are already being paid for, and finishing fills the cache for a page the
 *  reader may well come back to. */
export function demote(key: string, priority: Priority = "idle"): void {
  const task = queued.get(key);
  if (!task) return;
  if (PRIORITY_RANK[priority] <= PRIORITY_RANK[task.priority]) return;
  task.priority = priority;
  task.seq = ++seqCounter;
}

/**
 * Drops queued speculative work in `group` that is no longer worth doing.
 * Called when the reader moves, so yesterday's prefetch plan can't delay
 * today's. In-flight and critical tasks are never touched.
 *
 * Only tasks marked `speculative` are candidates: the group also carries
 * low-priority fetches that nothing will ever re-request (the sidebar previews),
 * and retiring those leaves the feature permanently missing rather than late.
 */
export function retainOnly(group: string, keepKeys: Iterable<string>): void {
  const keep = new Set(keepKeys);
  const drop: Task[] = [];
  queued.forEach((t) => {
    if (t.group !== group) return;
    if (t.priority === "critical") return;
    if (!t.speculative) return;
    if (!keep.has(t.key)) drop.push(t);
  });
  for (const t of drop) {
    queued.delete(t.key);
    t.reject(new AbortedError());
  }
}

/** Abandons everything pending for a group — e.g. the reader left the grantha. */
export function cancelGroup(group: string): void {
  const drop: Task[] = [];
  queued.forEach((t) => {
    if (t.group === group && t.priority !== "critical") drop.push(t);
  });
  for (const t of drop) {
    queued.delete(t.key);
    t.reject(new AbortedError());
  }
  running.forEach((t) => {
    if (t.group === group && t.priority === "idle" && t.controller) {
      t.preempted = false;
      t.controller.abort();
    }
  });
  pump();
}

export function schedulerStats(): {
  queued: number;
  running: number;
  byPriority: Record<Priority, number>;
} {
  const byPriority: Record<Priority, number> = { critical: 0, high: 0, idle: 0 };
  queued.forEach((t) => byPriority[t.priority]++);
  running.forEach((t) => byPriority[t.priority]++);
  return { queued: queued.size, running: running.size, byPriority };
}
