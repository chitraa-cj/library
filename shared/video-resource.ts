/**
 * Per-verse (and per-section / per-grantha) teaching videos.
 *
 * These are NOT fields on the manthra: they live in the CMS's `video-resource`
 * collection and are joined to content by `target_doc_id`, which for a mantra is
 * the manthra's `documentId` — the same value the reader uses as its verse id.
 */

export type VideoTargetType = "manthra" | "section" | "grantha";

/** One CMS row, normalised for the reader. */
export interface VideoResource {
  /** CMS documentId of the video row itself. */
  id: string;
  /** The raw URL as the editor entered it. */
  url: string;
  /** Extracted YouTube id, ready for an embed/thumbnail URL. */
  videoId: string;
  title: string | null;
  /** Where playback should begin, in seconds. */
  startSeconds: number;
  language: string | null;
  sortOrder: number;
  targetType: VideoTargetType;
  targetDocId: string;
}

/** Videos for one grantha, pre-grouped for lookup by the open verse. */
export interface BookVideos {
  /** Keyed by verse id (= manthra documentId). */
  byVerseId: Record<string, VideoResource[]>;
  /** Videos attached to the grantha as a whole. */
  book: VideoResource[];
}

export const EMPTY_BOOK_VIDEOS: BookVideos = { byVerseId: {}, book: [] };

/** `90`, `1m30s`, `2h3m4s` → seconds. YouTube accepts both forms in `t=`. */
function parseTimeParam(raw: string | null): number {
  if (!raw) return 0;
  const plain = Number(raw);
  if (Number.isFinite(plain)) return Math.max(0, Math.floor(plain));
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(raw.trim());
  if (!match) return 0;
  const [, h, m, s] = match;
  return Number(h || 0) * 3600 + Number(m || 0) * 60 + Number(s || 0);
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Pulls the video id (and any start time) out of whatever YouTube URL an editor
 * pasted: `watch?v=`, a `youtu.be` share link with its `?si=` tracking suffix,
 * `/embed/`, `/live/` or `/shorts/`. Returns null for anything unrecognised, so
 * a typo shows no video rather than a broken player.
 */
export function parseYouTubeUrl(url: string | null | undefined): { videoId: string; startSeconds: number } | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // A bare id is accepted too — editors sometimes paste just that.
  if (YOUTUBE_ID.test(trimmed)) return { videoId: trimmed, startSeconds: 0 };

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const segments = parsed.pathname.split("/").filter(Boolean);
  const startSeconds = parseTimeParam(parsed.searchParams.get("t") ?? parsed.searchParams.get("start"));

  let candidate: string | undefined;
  if (host === "youtu.be") {
    candidate = segments[0];
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (segments[0] === "watch") candidate = parsed.searchParams.get("v") ?? undefined;
    else if (segments[0] === "embed" || segments[0] === "live" || segments[0] === "shorts") candidate = segments[1];
    else candidate = parsed.searchParams.get("v") ?? undefined;
  }

  if (!candidate || !YOUTUBE_ID.test(candidate)) return null;
  return { videoId: candidate, startSeconds };
}

/** Embed URL for an iframe. `autoplay` is opt-in so thumbnails stay cheap. */
export function youTubeEmbedUrl(
  video: Pick<VideoResource, "videoId" | "startSeconds">,
  options: { autoplay?: boolean } = {},
): string {
  const params = new URLSearchParams();
  if (options.autoplay) params.set("autoplay", "1");
  if (video.startSeconds > 0) params.set("start", String(video.startSeconds));
  const query = params.toString();
  return `https://www.youtube.com/embed/${video.videoId}${query ? `?${query}` : ""}`;
}

export function youTubeThumbnailUrl(
  video: Pick<VideoResource, "videoId">,
  quality: "mq" | "hq" | "maxres" = "mq",
): string {
  return `https://img.youtube.com/vi/${video.videoId}/${quality}default.jpg`;
}

/**
 * Videos to show for the open verse: the verse's own if it has any, otherwise
 * the grantha's. Falling back rather than showing nothing keeps a video present
 * on the many mantras that don't have their own yet.
 */
export function videosForVerse(
  videos: BookVideos | undefined,
  verseId: string | null | undefined,
): { videos: VideoResource[]; inherited: boolean } {
  if (!videos) return { videos: [], inherited: false };
  const own = (verseId && videos.byVerseId[verseId]) || [];
  if (own.length > 0) return { videos: own, inherited: false };
  return { videos: videos.book, inherited: videos.book.length > 0 };
}
