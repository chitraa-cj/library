const STRAPI_URL = process.env.STRAPI_URL || "";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

interface PublishProgress {
  jobId: string;
  scope: "grantha" | "section" | "manthra";
  targetId: string;
  targetName: string;
  status: "running" | "completed" | "cancelled" | "error";
  totalManthras: number;
  processedManthras: number;
  publishedManthras: number;
  alreadyPublished: number;
  failedManthras: number;
  currentManthra: string;
  errors: string[];
  startedAt: string;
  completedAt: string | null;
}

const progressMap = new Map<string, PublishProgress>();
const cancelFlags = new Set<string>();

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function makeJobId(scope: string, targetId: string): string {
  return `${scope}:${targetId}`;
}

async function strapiGet<T = any>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`/api${endpoint}`, STRAPI_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Strapi GET ${endpoint} ${res.status}: ${t.substring(0, 200)}`);
  }
  return res.json();
}

async function strapiPut<T = any>(endpoint: string, body: any = {}): Promise<T> {
  const url = new URL(`/api${endpoint}`, STRAPI_URL);
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    const err = new Error(`Strapi PUT ${endpoint} ${res.status}: ${t.substring(0, 200)}`);
    (err as any).statusCode = res.status;
    throw err;
  }
  return res.json();
}

async function fetchAllPages<T = any>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    const r = await strapiGet<any>(endpoint, {
      ...params,
      "pagination[page]": String(page),
      "pagination[pageSize]": String(pageSize),
    });
    if (!r.data || !Array.isArray(r.data)) break;
    all.push(...r.data);
    if (!r.meta?.pagination || page >= r.meta.pagination.pageCount) break;
    page++;
  }
  return all;
}

interface ManthraRef {
  documentId: string;
  label: string;
  publishedAt: string | null;
}

async function fetchManthrasForGrantha(granthaDocId: string): Promise<ManthraRef[]> {
  const sections = await fetchAllPages("/sections", {
    "filters[grantha][documentId]": granthaDocId,
    "populate[0]": "sub_sections",
    "fields[0]": "documentId",
  });
  const leafIds = new Set<string>();
  for (const s of sections) {
    const hasSub = s.sub_sections && s.sub_sections.length > 0;
    if (!hasSub) leafIds.add(s.documentId);
  }
  return await collectManthrasFromSections(Array.from(leafIds));
}

async function fetchManthrasForSection(sectionDocId: string): Promise<ManthraRef[]> {
  const subSections = await fetchAllPages("/sections", {
    "filters[parent][documentId]": sectionDocId,
    "populate[0]": "sub_sections",
    "fields[0]": "documentId",
  });
  const leafIds = new Set<string>();
  if (subSections.length === 0) {
    leafIds.add(sectionDocId);
  } else {
    const stack: any[] = [...subSections];
    while (stack.length > 0) {
      const s = stack.pop();
      if (s.sub_sections && s.sub_sections.length > 0) {
        const children = await fetchAllPages("/sections", {
          "filters[parent][documentId]": s.documentId,
          "populate[0]": "sub_sections",
          "fields[0]": "documentId",
        });
        if (children.length === 0) leafIds.add(s.documentId);
        else stack.push(...children);
      } else {
        leafIds.add(s.documentId);
      }
    }
  }
  return await collectManthrasFromSections(Array.from(leafIds));
}

async function collectManthrasFromSections(sectionDocIds: string[]): Promise<ManthraRef[]> {
  const all: ManthraRef[] = [];
  for (const sid of sectionDocIds) {
    const items = await fetchAllPages<any>("/manthras", {
      "filters[Section][documentId]": sid,
      "fields[0]": "documentId",
      "fields[1]": "ShlokaManthraNumber",
      "fields[2]": "publishedAt",
      "fields[3]": "order",
      "publicationState": "preview",
      "sort": "order",
    });
    for (const m of items) {
      all.push({
        documentId: m.documentId,
        label: m.ShlokaManthraNumber || m.documentId,
        publishedAt: m.publishedAt || null,
      });
    }
  }
  return all;
}

async function publishManthraDoc(documentId: string): Promise<{ alreadyPublished: boolean }> {
  // In Strapi v5, calling actions/publish always pushes the current draft
  // state to the live version — so we always invoke it (it's a status flip,
  // not a content write, so no field data is overridden). The publishedAt
  // timestamp can't be trusted to detect pending draft edits.
  // Strapi v5: PUT with ?status=published publishes the current draft.
  // The body is empty so no field data is overridden — only the published
  // version is updated to reflect the latest draft state.
  await strapiPut(`/manthras/${documentId}?status=published`, { data: {} });
  return { alreadyPublished: false };
}

async function runPublishJob(
  jobId: string,
  manthras: ManthraRef[],
  progress: PublishProgress,
): Promise<void> {
  for (const m of manthras) {
    if (cancelFlags.has(jobId)) {
      progress.status = "cancelled";
      progress.completedAt = new Date().toISOString();
      cancelFlags.delete(jobId);
      return;
    }
    progress.currentManthra = m.label;
    let attempt = 0;
    let lastErr: any = null;
    while (attempt < 3) {
      try {
        const res = await publishManthraDoc(m.documentId);
        if (res.alreadyPublished) progress.alreadyPublished++;
        else progress.publishedManthras++;
        lastErr = null;
        break;
      } catch (err: any) {
        lastErr = err;
        const status = err.statusCode;
        if (status === 504 || status === 502 || status === 503 || status === 429) {
          attempt++;
          await delay(2000 * attempt);
          continue;
        }
        break;
      }
    }
    if (lastErr) {
      progress.failedManthras++;
      progress.errors.push(`${m.label} (${m.documentId}): ${lastErr.message}`);
    }
    progress.processedManthras++;
    await delay(300);
  }
  progress.status = "completed";
  progress.completedAt = new Date().toISOString();
}

export async function startPublishGrantha(granthaDocId: string): Promise<PublishProgress> {
  const jobId = makeJobId("grantha", granthaDocId);
  const existing = progressMap.get(jobId);
  if (existing && existing.status === "running") {
    return existing;
  }
  const granthaRes = await strapiGet<any>(`/granthas/${granthaDocId}`, {
    "fields[0]": "GranthaName",
    "fields[1]": "documentId",
  });
  const granthaName = granthaRes?.data?.GranthaName || granthaDocId;
  const manthras = await fetchManthrasForGrantha(granthaDocId);
  const progress: PublishProgress = {
    jobId,
    scope: "grantha",
    targetId: granthaDocId,
    targetName: granthaName,
    status: "running",
    totalManthras: manthras.length,
    processedManthras: 0,
    publishedManthras: 0,
    alreadyPublished: 0,
    failedManthras: 0,
    currentManthra: "",
    errors: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  progressMap.set(jobId, progress);
  runPublishJob(jobId, manthras, progress).catch((err) => {
    progress.status = "error";
    progress.errors.push(`Job error: ${err.message}`);
    progress.completedAt = new Date().toISOString();
  });
  return progress;
}

export async function startPublishSection(sectionDocId: string): Promise<PublishProgress> {
  const jobId = makeJobId("section", sectionDocId);
  const existing = progressMap.get(jobId);
  if (existing && existing.status === "running") {
    return existing;
  }
  const sectionRes = await strapiGet<any>(`/sections/${sectionDocId}`, {
    "fields[0]": "Name",
    "fields[1]": "documentId",
  });
  const sectionName = sectionRes?.data?.Name || sectionDocId;
  const manthras = await fetchManthrasForSection(sectionDocId);
  const progress: PublishProgress = {
    jobId,
    scope: "section",
    targetId: sectionDocId,
    targetName: sectionName,
    status: "running",
    totalManthras: manthras.length,
    processedManthras: 0,
    publishedManthras: 0,
    alreadyPublished: 0,
    failedManthras: 0,
    currentManthra: "",
    errors: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  progressMap.set(jobId, progress);
  runPublishJob(jobId, manthras, progress).catch((err) => {
    progress.status = "error";
    progress.errors.push(`Job error: ${err.message}`);
    progress.completedAt = new Date().toISOString();
  });
  return progress;
}

export async function startPublishManthra(manthraDocId: string): Promise<PublishProgress> {
  const jobId = makeJobId("manthra", manthraDocId);
  const existing = progressMap.get(jobId);
  if (existing && existing.status === "running") {
    return existing;
  }
  const progress: PublishProgress = {
    jobId,
    scope: "manthra",
    targetId: manthraDocId,
    targetName: manthraDocId,
    status: "running",
    totalManthras: 1,
    processedManthras: 0,
    publishedManthras: 0,
    alreadyPublished: 0,
    failedManthras: 0,
    currentManthra: manthraDocId,
    errors: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
  progressMap.set(jobId, progress);
  try {
    const res = await publishManthraDoc(manthraDocId);
    if (res.alreadyPublished) progress.alreadyPublished++;
    else progress.publishedManthras++;
    progress.processedManthras++;
    progress.status = "completed";
  } catch (err: any) {
    progress.failedManthras++;
    progress.errors.push(`${manthraDocId}: ${err.message}`);
    progress.status = "error";
  }
  progress.completedAt = new Date().toISOString();
  return progress;
}

export function getPublishProgress(jobId: string): PublishProgress | undefined {
  return progressMap.get(jobId);
}

export function getAllPublishJobs(): PublishProgress[] {
  return Array.from(progressMap.values()).sort((a, b) =>
    (b.startedAt || "").localeCompare(a.startedAt || ""),
  );
}

export function cancelPublishJob(jobId: string): boolean {
  const p = progressMap.get(jobId);
  if (!p) return false;
  if (p.status === "running") {
    cancelFlags.add(jobId);
    return true;
  }
  return false;
}
