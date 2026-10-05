/**
 * In-process metrics for the content path.
 *
 * The production box runs a bare Node process with no APM, so until now nothing
 * about latency, cache behaviour or origin load was observable — every
 * performance claim had to be made from the outside. This keeps a small,
 * fixed-memory set of counters and latency reservoirs and exposes them in
 * Prometheus text format, which any scraper (or `curl`) can read.
 *
 * Deliberately dependency-free and bounded: a metrics system that can leak
 * memory or add latency is worse than none.
 */

type Labels = Record<string, string>;

const counters = new Map<string, number>();
const gauges = new Map<string, () => number>();

/** Per-series ring buffer of recent observations, for quantiles. */
const RESERVOIR_SIZE = 2048;
interface Reservoir {
  values: Float64Array;
  count: number;
  sum: number;
}
const reservoirs = new Map<string, Reservoir>();

/** Bounds the number of distinct series so a bad label can't grow unbounded. */
const MAX_SERIES = 500;

function seriesKey(name: string, labels?: Labels): string {
  if (!labels) return name;
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}="${String(labels[k]).replace(/["\\\n]/g, "_")}"`);
  return parts.length ? `${name}{${parts.join(",")}}` : name;
}

export function incr(name: string, labels?: Labels, by = 1): void {
  const key = seriesKey(name, labels);
  const current = counters.get(key);
  if (current === undefined && counters.size >= MAX_SERIES) return;
  counters.set(key, (current ?? 0) + by);
}

export function observe(name: string, ms: number, labels?: Labels): void {
  const key = seriesKey(name, labels);
  let r = reservoirs.get(key);
  if (!r) {
    if (reservoirs.size >= MAX_SERIES) return;
    r = { values: new Float64Array(RESERVOIR_SIZE), count: 0, sum: 0 };
    reservoirs.set(key, r);
  }
  r.values[r.count % RESERVOIR_SIZE] = ms;
  r.count++;
  r.sum += ms;
}

export function setGauge(name: string, read: () => number, labels?: Labels): void {
  gauges.set(seriesKey(name, labels), read);
}

function quantiles(r: Reservoir): { p50: number; p95: number; p99: number; max: number } {
  const n = Math.min(r.count, RESERVOIR_SIZE);
  if (n === 0) return { p50: 0, p95: 0, p99: 0, max: 0 };
  const sorted = Array.from(r.values.subarray(0, n)).sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(n - 1, Math.max(0, Math.ceil(q * n) - 1))];
  return { p50: at(0.5), p95: at(0.95), p99: at(0.99), max: sorted[n - 1] };
}

/**
 * Route label for a request. Path parameters are collapsed so that a million
 * distinct verse ids don't become a million metric series.
 */
export function routeLabel(method: string, path: string): string {
  const normalised = path
    .replace(/^\/api\//, "/")
    // CMS documentIds are long, unbroken alphanumerics. Requiring no hyphen
    // keeps real path segments like "commentary-options" as themselves.
    .replace(/\/[A-Za-z0-9_]{15,}(?=\/|$)/g, "/:id")
    .replace(/\/\d+(?=\/|$)/g, "/:n");
  return `${method} ${normalised}`;
}

export interface MetricsSnapshot {
  uptimeSeconds: number;
  counters: Record<string, number>;
  gauges: Record<string, number>;
  latency: Record<string, { count: number; mean: number; p50: number; p95: number; p99: number; max: number }>;
}

const startedAt = Date.now();

export function snapshot(): MetricsSnapshot {
  const latency: MetricsSnapshot["latency"] = {};
  reservoirs.forEach((r, key) => {
    const q = quantiles(r);
    latency[key] = {
      count: r.count,
      mean: r.count ? Math.round((r.sum / r.count) * 10) / 10 : 0,
      p50: Math.round(q.p50 * 10) / 10,
      p95: Math.round(q.p95 * 10) / 10,
      p99: Math.round(q.p99 * 10) / 10,
      max: Math.round(q.max * 10) / 10,
    };
  });
  const gaugeValues: Record<string, number> = {};
  gauges.forEach((read, key) => {
    try {
      gaugeValues[key] = read();
    } catch {
      /* a broken gauge must not break the scrape */
    }
  });
  return {
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    counters: Object.fromEntries(counters),
    gauges: gaugeValues,
    latency,
  };
}

/** Prometheus text exposition. */
export function renderPrometheus(): string {
  const snap = snapshot();
  const lines: string[] = [];
  lines.push("# TYPE ssh_uptime_seconds gauge", `ssh_uptime_seconds ${snap.uptimeSeconds}`);
  for (const [key, value] of Object.entries(snap.counters)) lines.push(`${key} ${value}`);
  for (const [key, value] of Object.entries(snap.gauges)) lines.push(`${key} ${value}`);
  for (const [key, l] of Object.entries(snap.latency)) {
    const withQuantile = (q: string, v: number) =>
      key.includes("{")
        ? `${key.slice(0, -1)},quantile="${q}"} ${v}`
        : `${key}{quantile="${q}"} ${v}`;
    lines.push(withQuantile("0.5", l.p50), withQuantile("0.95", l.p95), withQuantile("0.99", l.p99));
    const base = key.includes("{") ? key.replace("{", "_count{") : `${key}_count`;
    lines.push(`${base} ${l.count}`);
  }
  return lines.join("\n") + "\n";
}

/** Resets everything. Test-only. */
export function resetMetrics(): void {
  counters.clear();
  reservoirs.clear();
}
