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
