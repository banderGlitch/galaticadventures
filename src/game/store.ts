import { create } from "zustand";
import { resetShip } from "./refs";
import { api, ApiError } from "../api/client";

export type Phase = "idle" | "playing" | "exploding" | "gameover";

/**
 * `"exploding"` is a brief cinematic pause between the collision and the
 * game-over screen. While it's active:
 *   - The HUD stays pinned on the final score.
 *   - All gameplay systems (asteroid spawning, coin magnetism, score ticks,
 *     ship motion) freeze, because they all gate on `phase === "playing"`.
 *   - `<Wreckage />` plays the destruction effect uninterrupted.
 */
export const EXPLOSION_HOLD_MS = 650;

export const HISTORY_LIMIT = 50;

/** A single completed run. Survives reloads via localStorage. */
export type RunRecord = {
  id: string;
  score: number;
  coins: number;
  durationMs: number;
  endedAt: number; // unix ms
};

/** Final response from the backend's /runs/end, surfaced to the UI so the
 *  GameOver screen can show the canonical rank/best-flag once it's known. */
export type ServerRunResult = {
  newBest: boolean;
  rank: number | null;
};

type GameState = {
  phase: Phase;
  score: number;
  bestScore: number;
  totalCoins: number;
  runsPlayed: number;
  startedAt: number;
  history: RunRecord[];

  /** Server-issued id from /runs/start. Null when the API is unreachable; the
   *  client then runs in pure local-only mode for that session. */
  runId: string | null;
  /** Most recent /runs/end response, set just after the explosion → game-over
   *  transition completes. UIs that need rank info read this. */
  lastResult: ServerRunResult | null;

  start: () => void;
  /** Immediate finalization. Used by `endRun()` once the dramatic pause expires. */
  end: () => void;
  /** Triggers the cinematic pause + delayed game-over. Safe to call multiple
   *  times; subsequent calls during an active explosion are ignored. */
  endRun: () => void;
  reset: () => void;
  /** Wipes persistent stats (best, coins, history). The danger button on the
   *  Profile tab calls this. */
  clearStats: () => void;
  addScore: (points: number) => void;
};

/* ─────────────────────────  persistence  ─────────────────────────
 *
 * v1 stored only `{ bestScore, totalCoins }`. v2 keeps the same fields
 * plus `runsPlayed` and `history`. We keep the same key (`asteroid-dodger:v1`)
 * for the read path so existing players don't lose their best score; new
 * fields are tolerated as missing.
 */

const STORAGE_KEY = "asteroid-dodger:v1";

type Persistent = {
  bestScore: number;
  totalCoins: number;
  runsPlayed: number;
  history: RunRecord[];
};

function isRunRecord(v: unknown): v is RunRecord {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.score === "number" &&
    typeof r.coins === "number" &&
    typeof r.durationMs === "number" &&
    typeof r.endedAt === "number"
  );
}

function loadPersistent(): Persistent {
  const empty: Persistent = { bestScore: 0, totalCoins: 0, runsPlayed: 0, history: [] };
  try {
    if (typeof localStorage === "undefined") return empty;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<Persistent>;
    const history = Array.isArray(parsed.history)
      ? parsed.history.filter(isRunRecord).slice(0, HISTORY_LIMIT)
      : [];
    return {
      bestScore: typeof parsed.bestScore === "number" ? parsed.bestScore : 0,
      totalCoins: typeof parsed.totalCoins === "number" ? parsed.totalCoins : 0,
      runsPlayed: typeof parsed.runsPlayed === "number" ? parsed.runsPlayed : history.length,
      history,
    };
  } catch {
    return empty;
  }
}

function savePersistent(state: Persistent): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage might be disabled in some Telegram clients; we just lose persistence.
  }
}

const persisted = loadPersistent();

function makeRunId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useGame = create<GameState>((set, get) => ({
  phase: "idle",
  score: 0,
  bestScore: persisted.bestScore,
  totalCoins: persisted.totalCoins,
  runsPlayed: persisted.runsPlayed,
  startedAt: 0,
  history: persisted.history,
  runId: null,
  lastResult: null,

  start: () => {
    resetShip();
    set({
      phase: "playing",
      score: 0,
      startedAt: performance.now(),
      runId: null,
      lastResult: null,
    });
    // Fire-and-forget: ask the backend to mint a server-side run id. We DO
    // NOT wait for this; the player should hit "Engage" and be flying within
    // a single frame. If the API is offline we'll just skip /runs/end too.
    api
      .startRun()
      .then((r) => {
        // Only adopt the id if we're still in this run. The user might have
        // already crashed and started a new one by the time the API returns.
        if (get().phase === "playing") set({ runId: r.runId });
      })
      .catch((err: unknown) => {
        // Soft-fail: dev/offline mode. Surfaces in console but never breaks
        // the game.
        if (err instanceof ApiError && err.status !== 0) {
          console.warn("[api] /runs/start failed:", err.status, err.body);
        }
      });
  },

  end: () => {
    const { score, bestScore, totalCoins, runsPlayed, history, startedAt, runId } = get();
    const finalScore = Math.max(0, Math.floor(score));
    const newBest = Math.max(bestScore, finalScore);
    const earned = Math.floor(finalScore / 10);
    const newCoins = totalCoins + earned;
    const newRunsPlayed = runsPlayed + 1;
    const durationMs = Math.max(0, Math.floor(performance.now() - startedAt));

    const record: RunRecord = {
      id: makeRunId(),
      score: finalScore,
      coins: earned,
      durationMs,
      endedAt: Date.now(),
    };
    // Newest first; cap at HISTORY_LIMIT.
    const newHistory = [record, ...history].slice(0, HISTORY_LIMIT);

    savePersistent({
      bestScore: newBest,
      totalCoins: newCoins,
      runsPlayed: newRunsPlayed,
      history: newHistory,
    });
    set({
      phase: "gameover",
      score: finalScore,
      bestScore: newBest,
      totalCoins: newCoins,
      runsPlayed: newRunsPlayed,
      history: newHistory,
      lastResult: null,
    });

    // Sync to backend if /runs/start completed successfully. Server is
    // authoritative for `rank`, and we trust its `newBest` flag over our
    // local guess once it answers.
    if (runId) {
      api
        .endRun({
          runId,
          score: finalScore,
          coins: earned,
          nearMisses: 0,
          durationMs,
        })
        .then((r) => {
          // Replace our optimistic stats with the server's truth so the
          // GameOver screen and Profile/Stats tabs converge instantly.
          set({
            bestScore: r.stats.best_score,
            totalCoins: r.stats.total_coins,
            runsPlayed: r.stats.runs_played,
            lastResult: { newBest: r.newBest, rank: r.rank },
          });
        })
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status !== 0) {
            console.warn("[api] /runs/end failed:", err.status, err.body);
          }
        });
    }
  },

  endRun: () => {
    if (get().phase !== "playing") return;
    set({ phase: "exploding" });
    setTimeout(() => {
      // Re-check: if the user navigated away or restarted during the hold,
      // we must not stomp the new state.
      if (useGame.getState().phase === "exploding") {
        useGame.getState().end();
      }
    }, EXPLOSION_HOLD_MS);
  },

  reset: () => {
    resetShip();
    set({ phase: "idle", score: 0 });
  },

  clearStats: () => {
    savePersistent({ bestScore: 0, totalCoins: 0, runsPlayed: 0, history: [] });
    set({
      bestScore: 0,
      totalCoins: 0,
      runsPlayed: 0,
      history: [],
    });
  },

  addScore: (points) => set((s) => ({ score: s.score + points })),
}));
