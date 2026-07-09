import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, BookText, User, Loader2, Link as LinkIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/lib/translations";

interface AcharyaListItem {
  slug: string;
  name_iast: string;
  name_devanagari: string;
  name_display: string | null;
  dates: string | null;
  lineage_order: number;
  category: string | null;
  avatar_url: string | null;
  bio_status: string | null;
  works_count: number;
  has_bio: boolean;
}

interface Work {
  type: string | null;
  title: string;
  source: string | null;
  remarks: string | null;
}

interface BioSection {
  heading: string;
  paragraphs: string[];
}

interface AcharyaDetail extends AcharyaListItem {
  aliases: string[] | null;
  guru_devanagari: string | null;
  biography: BioSection[] | null;
  works_list: Work[] | null;
  source_url: string | null;
}

/** Guru-parampara: browse the lineage of Advaita acharyas and their works. */
export function AcharyasPage({
  slug,
  onSelectAcharya,
  onBack,
  languageCode,
}: {
  slug: string | null;
  onSelectAcharya: (slug: string) => void;
  onBack: () => void;
  languageCode?: string | null;
}) {
  const { t } = useTranslation(languageCode ?? null);
  return slug ? (
    <AcharyaDetailView slug={slug} onBack={() => onBack()} t={t} />
  ) : (
    <AcharyaListView onSelectAcharya={onSelectAcharya} onBack={onBack} t={t} />
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</div>
    </div>
  );
}

function AcharyaListView({
  onSelectAcharya,
  onBack,
  t,
}: {
  onSelectAcharya: (slug: string) => void;
  onBack: () => void;
  t: (k: any) => string;
}) {
  const { data, isLoading, isError } = useQuery<AcharyaListItem[]>({
    queryKey: ["/api/acharyas"],
  });

  return (
    <PageShell>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
        data-testid="button-acharyas-back"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToHome") || "Back to Home"}
      </button>

      <div className="flex items-center gap-3 mb-1.5">
        <User className="h-6 w-6 text-primary shrink-0" />
        <h1 className="font-page-heading text-2xl sm:text-3xl font-bold text-primary tracking-tight">
          {t("acharyas") || "Acharyas"}
        </h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        {t("acharyasSubtitle") || "The guru-parampara — the lineage of masters who preserved and carried forward the Advaita vision."}
      </p>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t("loading") || "Loading…"}
        </div>
      )}
      {isError && (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          {t("acharyasUnavailable") || "Acharya profiles are temporarily unavailable."}
        </div>
      )}

      {data && data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {data.map((a, idx) => (
            <Card
              key={a.slug}
              className="group p-4 sm:p-5 cursor-pointer border-primary/15 hover:border-primary/40 hover:shadow-md transition-all flex items-start gap-3"
              onClick={() => onSelectAcharya(a.slug)}
              data-testid={`card-acharya-${a.slug}`}
            >
              <span className="mt-0.5 shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary font-body text-xs font-semibold flex items-center justify-center">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-base font-semibold text-foreground leading-tight truncate">
                  {a.name_display || a.name_iast}
                </h3>
                {a.name_devanagari && (
                  <p className="font-hindi-heading text-lg text-primary/90 leading-tight truncate">{a.name_devanagari}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {a.dates && <span>{a.dates}</span>}
                  {a.works_count > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <BookText className="h-3 w-3" /> {a.works_count} {a.works_count === 1 ? (t("work") || "work") : (t("works") || "works")}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function AcharyaDetailView({ slug, onBack, t }: { slug: string; onBack: () => void; t: (k: any) => string }) {
  const { data, isLoading, isError } = useQuery<AcharyaDetail>({
    queryKey: ["/api/acharyas", slug],
  });

  return (
    <PageShell>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-5"
        data-testid="button-acharya-detail-back"
      >
        <ArrowLeft className="h-4 w-4" /> {t("acharyas") || "Acharyas"}
      </button>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t("loading") || "Loading…"}
        </div>
      )}
      {isError && (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          {t("acharyasUnavailable") || "This acharya's profile is temporarily unavailable."}
        </div>
      )}

      {data && (
        <article className="max-w-3xl">
          <header className="border-b border-primary/15 pb-5 mb-6">
            <h1 className="font-page-heading text-3xl sm:text-4xl font-bold text-primary tracking-tight">
              {data.name_display || data.name_iast}
            </h1>
            {data.name_devanagari && (
              <p className="font-hindi-heading text-2xl sm:text-3xl text-foreground/90 mt-1">{data.name_devanagari}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {data.dates && <span>{data.dates}</span>}
              {data.guru_devanagari && (
                <span>
                  {t("guru") || "Guru"}: <span className="font-hindi-reading text-foreground/80">{data.guru_devanagari}</span>
                </span>
              )}
            </div>
          </header>

          {data.biography && data.biography.length > 0 ? (
            <section className="space-y-6">
              {data.biography.map((sec, i) => (
                <div key={i}>
                  {sec.heading && (
                    <h2 className="font-hindi-heading text-xl text-primary mb-2">{sec.heading}</h2>
                  )}
                  {sec.paragraphs?.map((p, j) => (
                    <p key={j} className="font-hindi-reading text-[15px] sm:text-base leading-relaxed sm:leading-loose text-foreground/90 mb-3">
                      {p}
                    </p>
                  ))}
                </div>
              ))}
            </section>
          ) : (
            <p className="text-sm text-muted-foreground italic py-2">
              {t("acharyaNoBio") || "A detailed biography for this acharya is not yet available."}
            </p>
          )}

          {data.works_list && data.works_list.length > 0 && (
            <section className="mt-8 pt-6 border-t border-primary/15">
              <h2 className="font-serif text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <BookText className="h-5 w-5 text-primary" /> {t("works") || "Works"} ({data.works_list.length})
              </h2>
              <ul className="space-y-3">
                {data.works_list.map((w, i) => (
                  <li key={i} className="rounded-lg border border-border/50 bg-card px-4 py-3">
                    <p className="font-hindi-reading text-base text-foreground">{w.title}</p>
                    {w.remarks && (
                      <p className="font-hindi-reading text-[13px] text-muted-foreground mt-1 leading-relaxed">{w.remarks}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.source_url && (
            <a
              href={data.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <LinkIcon className="h-3.5 w-3.5" /> {t("source") || "Source"}
            </a>
          )}
        </article>
      )}
    </PageShell>
  );
}
