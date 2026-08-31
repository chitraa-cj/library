// Global reading font-size preference. The nav-bar "+/-" control scales the
// whole app by adjusting the root <html> font-size (all rem-based text scales
// with it). Persisted in localStorage per-device; for logged-in users App also
// syncs the value to their account so it follows them across devices — mirroring
// how preferredLanguage works.

const KEY = "ssh:fontScale";
const EVENT = "ssh:fontScale-changed";

export const MIN_FONT_SCALE = 0.9;
export const MAX_FONT_SCALE = 1.4;
export const FONT_SCALE_STEP = 0.1;
export const DEFAULT_FONT_SCALE = 1;

/** Clamp to the allowed range and snap to one-decimal steps (0.9, 1.0, …). */
export function clampFontScale(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_FONT_SCALE;
  const snapped = Math.round(n * 10) / 10;
  return Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, snapped));
}

export function getFontScale(): number {
  try {
    const raw = parseFloat(localStorage.getItem(KEY) || "");
    if (!Number.isNaN(raw)) return clampFontScale(raw);
  } catch {
    /* ignore */
  }
  return DEFAULT_FONT_SCALE;
}

/** Apply the scale to the document root without persisting it. */
export function applyFontScale(scale: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${clampFontScale(scale) * 100}%`;
}

/** Persist + apply the scale, notify subscribers, and return the clamped value. */
export function setFontScale(scale: number): number {
  const value = clampFontScale(scale);
  try {
    localStorage.setItem(KEY, String(value));
  } catch {
    /* ignore */
  }
  applyFontScale(value);
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
  return value;
}

export function subscribeFontScale(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// Apply the persisted scale as soon as this module loads (before React paints)
// so there is no flash of the default size on refresh.
if (typeof document !== "undefined") {
  applyFontScale(getFontScale());
}
