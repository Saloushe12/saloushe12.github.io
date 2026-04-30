/** localStorage key for chatChannelId -> actorId -> CSS color */
export const ACTOR_COLOR_STORAGE_KEY = "designftw-actor-colors-v1";

/** @returns {Record<string, Record<string, string>>} */
export function loadActorColorMap() {
  try {
    const raw = localStorage.getItem(ACTOR_COLOR_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveActorColorMap(map) {
  localStorage.setItem(ACTOR_COLOR_STORAGE_KEY, JSON.stringify(map));
}

/**
 * Readable saturated hues on dark UI backgrounds (~#1e1f22, #313338).
 * Avoids very dark or very light extremes.
 */
export function randomReadableHandleColor() {
  const h = Math.floor(Math.random() * 360);
  const s = 50 + Math.floor(Math.random() * 30); /* 50–79% */
  const l = 62 + Math.floor(Math.random() * 18); /* 62–79% */
  return `hsl(${h} ${s}% ${l}%)`;
}
