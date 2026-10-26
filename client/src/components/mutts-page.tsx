import { useCallback, useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Flower2, Landmark, MapPin, Church, Building2, TreePalm, Users } from "lucide-react";
import { MUTT_SECTIONS, muttSlug, muttsPath, preloadImages, preloadMuttThumbs, type Mutt, type MuttSection, type MuttSectionIcon } from "@/lib/advaita-mutts";
import { MUTT_DETAILS, type MuttDetail, type MuttFacts } from "@/lib/advaita-mutt-details";
import { SiteFooter } from "@/components/welcome-screen";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

type Navigate = (path: string, opts?: { replace?: boolean }) => void;

// Start the hero + card images the moment this chunk loads (before first render),
// so the open "principal peethas" section shows them complete, not mid-download.
preloadMuttThumbs();

/**
 * An <img> that stays transparent until fully loaded, then fades in — no
 * top-to-bottom partial paint. Cached images (see preloadImages) show at once.
 */
function FadeImage({ className = "", onLoad, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);
  // An image already in cache can finish before React attaches onLoad.
  const ref = useCallback((el: HTMLImageElement | null) => { if (el?.complete && el.naturalWidth) setLoaded(true); }, []);
  return (
    <img
      ref={ref}
      decoding="async"
      {...props}
      onLoad={(e) => { setLoaded(true); onLoad?.(e); }}
      className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
    />
  );
}

/** Researched address usable as a map location (scriptural kshetras like Kailasa aren't). */
const mappableAddress = (address?: string) => (address && !/scriptural/i.test(address) ? address : undefined);

const rawDetailFor = (sectionId: string, m: Mutt): MuttDetail | undefined => MUTT_DETAILS[`${sectionId}/${muttSlug(m.name)}`];

/** Placeholder text that tells a reader nothing; never rendered. */
const FILLER = [/^little published information/i, /^listed as being in the parampara/i];
const isFiller = (t?: string) => !t || FILLER.some((re) => re.test(t));

/**
 * The detail with filler stripped, or undefined when nothing worth reading is
 * left (an address alone isn't enough) — such mutts get no panel at all.
 */
const detailFor = (sectionId: string, m: Mutt): MuttDetail | undefined => {
  const d = rawDetailFor(sectionId, m);
  if (!d) return undefined;
  const overview = isFiller(d.overview) ? undefined : d.overview;
  const facts: MuttFacts = Object.fromEntries(Object.entries(d.facts).filter(([, v]) => !isFiller(v)));
  const substantive =
    overview || d.history || d.highlights.length > 0 || d.website ||
    Object.keys(facts).some((k) => k !== "address" && k !== "currentHeadAsOf");
  return substantive ? { ...d, overview, facts } : undefined;
};

const SECTION_ICONS: Record<MuttSectionIcon, typeof Landmark> = {
  peetha: Landmark,
  additional: Flower2,
  parampara: Users,
  puri: Church,
  kasi: Building2,
  kerala: TreePalm,
};

/** Ring around the mutt a deep link points at. */
const HIGHLIGHT = "ring-2 ring-primary ring-offset-2 ring-offset-background";

const mapsUrl = (m: Mutt) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${m.name}, ${m.location}`)}`;

/**
 * The Advaita mutt system: principal peethas and the wider network of mathas.
 * `sectionId` / `muttId` come from the URL (/mutts/<section>/<mutt>); the page
 * opens that section, scrolls to it, highlights the mutt and shows its details.
 */
export function MuttsPage({ sectionId, muttId, onNavigate, onBack, onBrowseLibrary }: {
  sectionId?: string | null;
  muttId?: string | null;
  onNavigate: Navigate;
  onBack: () => void;
  onBrowseLibrary: () => void;
}) {
  const target = MUTT_SECTIONS.find((s) => s.id === sectionId) ?? null;
  // The cardinal peethas start open; any number of sections can be open at once.
  const [open, setOpen] = useState<Set<string>>(() => new Set([MUTT_SECTIONS[0].id, ...(target ? [target.id] : [])]));

  const lastTargetId = useRef<string | null>(null);
  useEffect(() => {
    if (!target) return;
    // Closing the drawer (/mutts/s/m → /mutts/s) shouldn't yank the page back up.
    const closingDrawer = !muttId && lastTargetId.current === target.id;
    lastTargetId.current = target.id;
    if (closingDrawer) return;
    setOpen((prev) => (prev.has(target.id) ? prev : new Set(prev).add(target.id)));
    // Wait a frame so a just-opened section has laid out before scrolling to it.
    const raf = requestAnimationFrame(() => {
      const el =
        (muttId && document.getElementById(`mutt-${target.id}-${muttId}`)) ||
        document.getElementById(`mutt-section-${target.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: muttId ? "center" : "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [target, muttId]);

  // The detail drawer is driven by the URL, so it survives reloads and Back closes it.
  const targetMutt = target && muttId ? target.mutts.find((m) => muttSlug(m.name) === muttId) ?? null : null;
  const targetDetail = target && targetMutt ? detailFor(target.id, targetMutt) : undefined;

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="flex-1 overflow-y-auto bg-background" data-testid="mutts-page">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        <img
          src="/images/mutts/hero-v2.webp"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none select-none absolute right-0 top-0 h-full w-full sm:w-[70%] object-cover object-right mix-blend-multiply dark:mix-blend-normal opacity-40 sm:opacity-100 dark:opacity-25"
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-10 sm:pb-16">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
            data-testid="button-mutts-back"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </button>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-primary">Traditions of Advaita</span>
            <span className="h-px w-16 bg-primary/40" />
          </div>
          <h1 className="font-page-heading text-3xl sm:text-4xl lg:text-5xl text-primary tracking-tight mb-4">
            The Advaita Mutt System
          </h1>
          <p className="font-body text-sm sm:text-base text-foreground/80 max-w-xl">
            Explore the monasteries, peethas and spiritual centres associated with the Advaita tradition established by Adi Shankaracharya.
          </p>
        </div>
      </section>

      {/* ===== SECTIONS ===== */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-4">
        {MUTT_SECTIONS.map((section, i) => (
          <MuttSectionPanel
            key={section.id}
            index={i + 1}
            section={section}
            isOpen={open.has(section.id)}
            onToggle={() => toggle(section.id)}
            highlightId={section.id === target?.id ? muttId ?? null : null}
            onOpenMutt={(m) => onNavigate(muttsPath(section.id, m.name))}
          />
        ))}
      </div>

      <SiteFooter onBrowseLibrary={onBrowseLibrary} />

      {target && targetMutt && targetDetail && (
        <MuttDetailSheet
          section={target}
          mutt={targetMutt}
          detail={targetDetail}
          onNavigate={onNavigate}
          onClose={() => onNavigate(muttsPath(target.id), { replace: true })}
        />
      )}
    </div>
  );
}

function MuttSectionPanel({ index, section, isOpen, onToggle, highlightId, onOpenMutt }: {
  index: number;
  section: MuttSection;
  isOpen: boolean;
  onToggle: () => void;
  /** Slug of the mutt the URL points at, if it is in this section. */
  highlightId: string | null;
  onOpenMutt: (m: Mutt) => void;
}) {
  const Icon = SECTION_ICONS[section.icon];
  const panelId = `mutt-section-${section.id}`;
  return (
    <section
      id={`mutt-section-${section.id}`}
      className={`scroll-mt-4 rounded-xl border transition-colors ${isOpen ? "border-2 border-primary bg-primary/[0.03]" : "border-border/70 bg-card"}`}
      data-testid={`mutt-section-${section.id}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full flex items-center gap-3 sm:gap-5 px-4 sm:px-5 py-4 text-left"
      >
        <span className="font-serif text-lg sm:text-xl font-bold text-primary w-7 shrink-0">{String(index).padStart(2, "0")}</span>
        <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-primary/80 shrink-0" strokeWidth={1.5} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-serif text-lg sm:text-xl font-bold text-primary">{section.title}</span>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary whitespace-nowrap">
              {section.mutts.length} entries
            </span>
          </span>
          <span className="block text-xs text-muted-foreground mt-1">{section.description}</span>
        </span>
        <ChevronDown className={`h-5 w-5 text-primary shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div id={panelId} className="border-t border-primary/20 px-4 sm:px-5 py-5 animate-in fade-in-0 duration-200">
          {section.mutts.some((m) => m.image) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
              {section.mutts.map((m, i) => (
                // Four cards on the first row, the rest share the next row(s) three-up.
                <div
                  key={m.name}
                  id={`mutt-${section.id}-${muttSlug(m.name)}`}
                  className={`rounded-lg ${i < 4 ? "lg:col-span-3" : "lg:col-span-4"} ${highlightId === muttSlug(m.name) ? HIGHLIGHT : ""}`}
                >
                  <MuttImageCard mutt={m} onOpen={() => onOpenMutt(m)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {section.mutts.map((m, i) => (
                <div
                  key={m.name + i}
                  id={`mutt-${section.id}-${muttSlug(m.name)}`}
                  className={`rounded-lg ${highlightId === muttSlug(m.name) ? HIGHLIGHT : ""}`}
                >
                  <MuttTextCard
                    mutt={m}
                    index={i + 1}
                    detail={detailFor(section.id, m)}
                    address={mappableAddress(rawDetailFor(section.id, m)?.facts.address)}
                    onOpen={() => onOpenMutt(m)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Cards use a stretched link: the title button covers the whole card, while the
// maps link sits above it (relative z-10) so both stay separately clickable.
const CARD = "relative h-full flex overflow-hidden rounded-lg border border-border/70 bg-card transition-colors hover:border-primary/50 hover:shadow-md";
const STRETCH = "text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary focus-visible:after:rounded-lg";

function MuttImageCard({ mutt, onOpen }: { mutt: Mutt; onOpen: () => void }) {
  return (
    // Warm the drawer's large image on intent, so it's ready when the drawer opens.
    <article className={`${CARD} flex-col shadow-sm`} onPointerEnter={() => preloadImages([mutt.image])} onFocus={() => preloadImages([mutt.image])}>
      <div className="h-36 w-full bg-muted">
        <FadeImage src={mutt.thumb} alt={mutt.name} fetchPriority="high" className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-1 flex-col px-3 py-3">
        <h3 className="font-serif text-base font-bold text-primary">
          <button type="button" onClick={onOpen} className={STRETCH}>{mutt.name}</button>
        </h3>
        {mutt.aliases && <p className="text-xs text-muted-foreground mt-0.5">({mutt.aliases})</p>}
        {mutt.note && <p className="text-xs text-muted-foreground mt-0.5">{mutt.note}</p>}
        <MuttLocation mutt={mutt} className="mt-auto pt-4" />
      </div>
    </article>
  );
}

/** Text card; only mutts with real content are clickable (no empty panels). */
function MuttTextCard({ mutt, index, detail, address, onOpen }: {
  mutt: Mutt;
  index: number;
  detail?: MuttDetail;
  /** Researched address, used when the source list gives no location. */
  address?: string;
  onOpen: () => void;
}) {
  // Cards are compact: drop trailing qualifiers like "(inferred from name)"; the panel keeps them.
  const location = mutt.location || address?.replace(/\s*\((?:inferred|likely|probable)[^)]*\)$/i, "");
  return (
    <article className={detail ? `${CARD} gap-3 px-3 py-3` : "h-full flex gap-3 rounded-lg border border-border/50 bg-card/60 px-3 py-3"}>
      <span className="font-serif text-sm font-bold text-primary/50 w-5 shrink-0 pt-0.5">{index}.</span>
      <div className="min-w-0 flex flex-1 flex-col">
        <h3 className="font-serif text-[15px] font-bold text-primary flex items-start gap-1">
          {detail ? (
            <>
              <button type="button" onClick={onOpen} className={`${STRETCH} min-w-0 flex-1`}>{mutt.name}</button>
              <ChevronRight className="h-4 w-4 text-primary/40 shrink-0 mt-0.5" />
            </>
          ) : (
            <span className="min-w-0 flex-1">{mutt.name}</span>
          )}
        </h3>
        {mutt.aliases && <p className="text-xs text-muted-foreground mt-0.5">(also {mutt.aliases})</p>}
        {mutt.note && <p className="text-xs text-muted-foreground mt-0.5">{mutt.note}</p>}
        {detail?.overview && !mutt.note ? (
          <p className="text-xs text-foreground/70 mt-1 line-clamp-2">{detail.overview}</p>
        ) : !detail && !mutt.note && (
          <p className="text-xs italic text-muted-foreground/70 mt-1">Known only from its listing in the source.</p>
        )}
        {location && <MuttLocation mutt={{ ...mutt, location }} className="mt-auto pt-2" />}
      </div>
    </article>
  );
}

function MuttLocation({ mutt, className = "" }: { mutt: Mutt; className?: string }) {
  if (!mutt.location) return null;
  return (
    <a
      href={mapsUrl(mutt)}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative z-10 flex items-center gap-1.5 text-[11px] text-foreground/70 hover:text-primary transition-colors ${className}`}
      title="Open in Google Maps"
    >
      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="min-w-0 flex-1 truncate">{mutt.location}</span>
      <ArrowUpRight className="h-3.5 w-3.5 text-primary shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </a>
  );
}

const FACT_LABELS: [keyof MuttFacts, string][] = [
  ["amnaya", "Āmnāya"],
  ["veda", "Veda"],
  ["mahavakya", "Mahāvākya"],
  ["deity", "Presiding deity"],
  ["firstAcharya", "First acharya"],
  ["founded", "Founded"],
  ["lineage", "Lineage"],
  ["currentHead", "Current head"],
  ["address", "Address"],
];

/** Right-hand drawer with the researched content for one mutt. */
function MuttDetailSheet({ section, mutt, detail, onNavigate, onClose }: {
  section: MuttSection;
  mutt: Mutt;
  detail: MuttDetail;
  onNavigate: Navigate;
  onClose: () => void;
}) {
  // Prev/next step through the mutts that have a panel, skipping listing-only ones.
  const openable = section.mutts.filter((m) => detailFor(section.id, m));
  const idx = openable.indexOf(mutt);
  const prev = openable[idx - 1];
  const next = openable[idx + 1];
  // Stepping between mutts replaces the entry, so Back still leaves the drawer in one step.
  const go = (m: Mutt) => onNavigate(muttsPath(section.id, m.name), { replace: true });
  const facts = FACT_LABELS.filter(([k]) => detail.facts[k]);

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col gap-0 overflow-hidden" data-testid="mutt-detail-sheet">
        <div className="flex-1 overflow-y-auto">
          {mutt.image ? (
            // The (already cached) thumbnail fills in while the full-size image loads.
            <div className="h-48 sm:h-56 w-full bg-muted bg-cover bg-center" style={mutt.thumb ? { backgroundImage: `url(${mutt.thumb})` } : undefined}>
              <FadeImage key={mutt.image} src={mutt.image} alt={mutt.name} fetchPriority="high" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-24 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          )}
          <div className="px-5 sm:px-6 pt-5 pb-8">
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-primary mb-1.5">{section.title}</p>
            <SheetTitle className="font-serif text-2xl font-bold text-primary leading-tight">{mutt.name}</SheetTitle>
            {mutt.aliases && <p className="text-sm text-muted-foreground mt-1">Also known as {mutt.aliases}</p>}
            <SheetDescription className="sr-only">Details, history and sources for {mutt.name}.</SheetDescription>
            {(mutt.location || mappableAddress(detail.facts.address)) && (
              <MuttLocation mutt={{ ...mutt, location: mutt.location || mappableAddress(detail.facts.address) }} className="mt-3 text-xs" />
            )}

            {mutt.note && (
              <blockquote className="mt-4 border-l-2 border-primary/40 pl-3 text-sm italic text-foreground/80">{mutt.note}</blockquote>
            )}

            {detail.overview && (
              <>
                <h4 className="mt-6 mb-1.5 text-xs uppercase tracking-[0.15em] font-semibold text-muted-foreground">Overview</h4>
                <p className="text-sm leading-relaxed text-foreground/90">{detail.overview}</p>
              </>
            )}

                {detail.history && (
                  <>
                    <h4 className="mt-5 mb-1.5 text-xs uppercase tracking-[0.15em] font-semibold text-muted-foreground">History</h4>
                    <p className="text-sm leading-relaxed text-foreground/90">{detail.history}</p>
                  </>
                )}

                {facts.length > 0 && (
                  <dl className="mt-5 divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70 bg-card">
                    {facts.map(([k, label]) => (
                      <div key={k} className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-x-4 gap-y-0.5 px-3 py-2.5">
                        <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:pt-1">{label}</dt>
                        <dd className="text-sm text-foreground">
                          {detail.facts[k]}
                          {k === "currentHead" && detail.facts.currentHeadAsOf && (
                            <span className="text-xs text-muted-foreground"> (as of {detail.facts.currentHeadAsOf})</span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                {detail.highlights.length > 0 && (
                  <>
                    <h4 className="mt-5 mb-1.5 text-xs uppercase tracking-[0.15em] font-semibold text-muted-foreground">Highlights</h4>
                    <ul className="space-y-1.5">
                      {detail.highlights.map((h) => (
                        <li key={h} className="flex gap-2 text-sm text-foreground/90">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {detail.website && (
                  <a
                    href={detail.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3.5 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
                  >
                    Official website <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}

                {detail.sources.length > 0 && (
                  <>
                    <h4 className="mt-6 mb-1.5 text-xs uppercase tracking-[0.15em] font-semibold text-muted-foreground">Sources</h4>
                    <ol className="space-y-1 list-decimal pl-4 marker:text-muted-foreground/60">
                      {detail.sources.map((src) => (
                        <li key={src.url} className="text-xs">
                          <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-foreground/70 hover:text-primary underline-offset-2 hover:underline break-words">
                            {src.title}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-between gap-2 border-t border-border/70 bg-background px-3 py-2.5">
          <button
            type="button"
            disabled={!prev}
            onClick={() => prev && go(prev)}
            className="inline-flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-primary disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" /> <span className="truncate">{prev?.name ?? "Previous"}</span>
          </button>
          <span className="text-[11px] text-muted-foreground/70 shrink-0">{idx + 1} / {openable.length}</span>
          <button
            type="button"
            disabled={!next}
            onClick={() => next && go(next)}
            className="inline-flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-primary disabled:opacity-30 disabled:pointer-events-none"
          >
            <span className="truncate">{next?.name ?? "Next"}</span> <ChevronRight className="h-4 w-4 shrink-0" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
