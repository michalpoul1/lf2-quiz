/**
 * Format a duration (seconds or milliseconds) as "m:ss" or "h:mm:ss"
 * depending on magnitude. Used by the per-question timer, question list
 * and statistics pages.
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format a duration in MILLISECONDS as m:ss / h:mm:ss. */
export function formatMmSs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${m}:${pad2(s)}`;
}

/** Format a duration in SECONDS as m:ss / h:mm:ss. */
export function formatSeconds(sec: number): string {
  return formatMmSs(sec * 1000);
}

/** Human-readable longer form, used on the statistics page.
 *  e.g. 754 → "12 min 34 s"; 45 → "45 s"; 3665 → "1 h 1 min 5 s". */
export function formatHumanDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0 s";
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} h`);
  if (m > 0) parts.push(`${m} min`);
  if (s > 0 || parts.length === 0) parts.push(`${s} s`);
  return parts.join(" ");
}
