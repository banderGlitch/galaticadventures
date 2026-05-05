/**
 * Tiny perf-tier probe. Decides whether expensive postprocessing (e.g. bloom)
 * should be enabled on this device.
 *
 * Resolution order:
 *   1. URL param `?perf=low|high` (handy for quick A/B testing)
 *   2. localStorage `asteroid-dodger:perf` (user override, survives reloads)
 *   3. Heuristic: coarse pointer (touch-only) + ≤4 logical cores → low.
 *      Otherwise high. This is a deliberately conservative cutoff;
 *      mid-range and modern phones reliably report 6–8 cores.
 */

export type PerfTier = "low" | "high";

const STORAGE_KEY = "asteroid-dodger:perf";

function readOverride(): PerfTier | null {
  if (typeof window === "undefined") return null;

  try {
    const url = new URLSearchParams(window.location.search);
    const param = url.get("perf");
    if (param === "low" || param === "high") return param;
  } catch {
    // location.search can throw in obscure embedding contexts; ignore.
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "low" || stored === "high") return stored;
  } catch {
    // Storage may be disabled in some Telegram clients; ignore.
  }

  return null;
}

function detectAuto(): PerfTier {
  if (typeof window === "undefined") return "high";

  const isCoarse =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;
  const cores = navigator.hardwareConcurrency ?? 4;

  return isCoarse && cores <= 4 ? "low" : "high";
}

let cached: PerfTier | null = null;

export function getPerfTier(): PerfTier {
  if (cached !== null) return cached;
  cached = readOverride() ?? detectAuto();
  return cached;
}

export function setPerfTier(tier: PerfTier): void {
  cached = tier;
  try {
    window.localStorage.setItem(STORAGE_KEY, tier);
  } catch {
    // ignore
  }
}
