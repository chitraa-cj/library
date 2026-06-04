export { resolveBookCoverImage } from "@/lib/upanishad-cover-images";

interface BookLandingCoverHeroProps {
  coverImage: string;
  /** Grow to fill leftover viewport space (landing fits one screen, no page scroll). */
  fillViewport?: boolean;
}

export function BookLandingCoverHero({ coverImage, fillViewport = false }: BookLandingCoverHeroProps) {
  if (fillViewport) {
    return (
      <div
        className="group relative flex min-h-0 flex-1 basis-0 w-full items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/[0.03] shadow-[0_24px_60px_-40px_hsl(var(--foreground)/0.5)]"
        data-testid="book-landing-cover-hero"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background/40 to-transparent" />
        <img
          src={coverImage}
          alt=""
          className="h-full w-full object-contain object-center transition-transform duration-500 group-hover:scale-[1.015]"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className="mt-4 w-full overflow-hidden rounded-xl border border-border/60 shadow-[0_18px_40px_-30px_hsl(var(--foreground)/0.45)]"
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
