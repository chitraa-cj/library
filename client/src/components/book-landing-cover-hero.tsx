/** Static covers in client/public/images/upanishads/{slug}.png — add files as designs are ready. */
const LOCAL_UPANISHAD_COVERS: { match: (slug: string, title: string) => boolean; src: string }[] = [
  {
    match: (slug, title) =>
      slug.startsWith("taittariya") || slug.includes("taittiriya") || title.includes("taittiriya"),
    src: "/images/upanishads/taittiriya.png",
  },
];

function resolveLocalUpanishadCover(slug: string, title: string): string | null {
  for (const entry of LOCAL_UPANISHAD_COVERS) {
    if (entry.match(slug, title)) return entry.src;
  }
  return null;
}

/** Local bundled art takes precedence; then CMS coverImage from Strapi. */
export function resolveBookCoverImage(book: {
  slug?: string | null;
  title?: string | null;
  coverImage?: string | null;
}): string | null {
  const slug = (book.slug || "").toLowerCase();
  const title = (book.title || "").toLowerCase();
  const local = resolveLocalUpanishadCover(slug, title);
  if (local) return local;
  if (book.coverImage) return book.coverImage;
  return null;
}

interface BookLandingCoverHeroProps {
  coverImage: string;
  /** Grow to fill leftover viewport space (landing fits one screen, no page scroll). */
  fillViewport?: boolean;
}

export function BookLandingCoverHero({ coverImage, fillViewport = false }: BookLandingCoverHeroProps) {
  if (fillViewport) {
    return (
      <div
        className="flex min-h-0 flex-1 basis-0 w-full items-center justify-center overflow-hidden rounded-md bg-muted/[0.04]"
        data-testid="book-landing-cover-hero"
      >
        <img
          src={coverImage}
          alt=""
          className="h-full w-full object-contain object-center"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className="mt-4 w-full overflow-hidden rounded-lg border border-border/60"
      data-testid="book-landing-cover-hero"
    >
      <img
        src={coverImage}
        alt=""
        className="block w-full h-auto max-h-[min(40vh,420px)] object-cover object-center"
        loading="lazy"
      />
    </div>
  );
}
