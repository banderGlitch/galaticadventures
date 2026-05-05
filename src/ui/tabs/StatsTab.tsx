import { motion } from "framer-motion";
import { useMemo } from "react";
import { useGame, type RunRecord } from "../../game/store";
import { useMe } from "../../api/hooks";
import { api } from "../../api/client";
import BracketCorners from "../BracketCorners";

/**
 * Stats tab — player's totals, score curve, and recent runs.
 *
 * Source-of-truth strategy:
 *   - On mount, fetch /api/me. The server's `recent` and `stats` are
 *     canonical when available.
 *   - If the fetch fails (offline, backend down, etc.), we fall back to the
 *     local Zustand store, which is updated optimistically on every run.
 *   - The fall-through is invisible to the player; we only surface a small
 *     "OFFLINE" tag so they know why their friends' progress isn't showing.
 */

export default function StatsTab() {
  const { data, loading, error } = useMe();

  const localHistory = useGame((s) => s.history);
  const localBest = useGame((s) => s.bestScore);
  const localCoins = useGame((s) => s.totalCoins);
  const localRuns = useGame((s) => s.runsPlayed);

  const usingServer = data !== null && error === null;

  // Map server runs into the same shape as local RunRecord so the row
  // component doesn't need to know which source it's reading from.
  const history: RunRecord[] = useMemo(() => {
    if (data) {
      return data.recent.map((r) => ({
        id: r.id,
        score: r.score,
        coins: r.coins,
        durationMs: r.durationMs,
        // The backend currently returns naive ISO timestamps from SQLAlchemy;
        // append "Z" so JS treats them as UTC instead of local time.
        endedAt: new Date(r.endedAt.endsWith("Z") ? r.endedAt : `${r.endedAt}Z`).getTime(),
      }));
    }
    return localHistory;
  }, [data, localHistory]);

  const bestScore = usingServer ? data!.stats.best_score : localBest;
  const totalCoins = usingServer ? data!.stats.total_coins : localCoins;
  const runsPlayed = usingServer ? data!.stats.runs_played : localRuns;

  const totalScore = history.reduce((acc, r) => acc + r.score, 0);
  const avgScore = history.length > 0 ? Math.round(totalScore / history.length) : 0;

  const recent = history.slice(0, 12);
  const longestRunMs = history.reduce((m, r) => Math.max(m, r.durationMs), 0);

  return (
    <motion.section
      key="stats"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28 }}
      className="tab-page"
    >
      <header className="tab-header">
        <span className="tag">
          <SourceDot loading={loading} usingServer={usingServer} />
          {loading ? "Syncing" : usingServer ? "Mission log" : "Offline log"}
        </span>
        <h2 className="title-wordmark text-3xl mt-2">Stats</h2>
        <p className="eyebrow mt-1">// Sector 7-A telemetry</p>
      </header>

      <div className="panel mt-5 relative">
        <BracketCorners />
        <div className="grid grid-cols-2 gap-4">
          <KPI label="Best run" value={bestScore.toLocaleString()} accent="var(--neon-cyan)" />
          <KPI
            label="Cores"
            value={totalCoins.toLocaleString()}
            accent="var(--neon-amber)"
          />
          <KPI label="Runs" value={runsPlayed.toLocaleString()} accent="var(--neon-violet)" />
          <KPI
            label="Avg score"
            value={avgScore.toLocaleString()}
            accent="var(--neon-magenta)"
          />
        </div>
      </div>

      <div className="mt-6">
        <div className="rule-diamond">Recent runs</div>

        {recent.length === 0 ? (
          <div className="panel mt-4 text-center">
            <p className="tagline">
              No runs logged yet. Hit{" "}
              <span className="font-display tracking-wider text-neon-cyan">Play</span>{" "}
              to start your mission log.
            </p>
          </div>
        ) : (
          <>
            <Sparkline runs={recent} />
            <ul className="mt-4 space-y-2">
              {recent.map((r) => (
                <RunRow key={r.id} run={r} isBest={r.score === bestScore} />
              ))}
            </ul>
            {longestRunMs > 0 && (
              <p className="eyebrow mt-4 text-center">
                Longest survival :: {(longestRunMs / 1000).toFixed(1)}s
              </p>
            )}
          </>
        )}
      </div>

      {error && !api.isLocal() && (
        <p className="eyebrow mt-6 text-center text-fg/50">
          // backend unreachable :: {error.status || "network"}
        </p>
      )}
    </motion.section>
  );
}

/* ───────────────────────────  pieces  ─────────────────────────── */

function SourceDot({
  loading,
  usingServer,
}: {
  loading: boolean;
  usingServer: boolean;
}) {
  if (loading) {
    return <span className="tag-dot" style={{ background: "var(--fg-mute)" }} />;
  }
  if (usingServer) return <span className="tag-dot tag-dot--live" />;
  return <span className="tag-dot" style={{ background: "var(--neon-amber)" }} />;
}

function KPI({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-fg/55">
        {label}
      </span>
      <span
        className="font-mono mt-1 text-2xl font-semibold tabular-nums leading-tight"
        style={{ color: accent, textShadow: `0 0 14px ${accent}aa` }}
      >
        {value}
      </span>
    </div>
  );
}

const SPARK_W = 280;
const SPARK_H = 64;
const SPARK_PADDING = 4;

function Sparkline({ runs }: { runs: RunRecord[] }) {
  if (runs.length < 2) return null;

  // Render oldest-on-left so the line "marches forward" with time.
  const ordered = [...runs].reverse();
  const max = Math.max(...ordered.map((r) => r.score), 1);
  const min = Math.min(...ordered.map((r) => r.score), 0);
  const range = Math.max(1, max - min);

  const innerW = SPARK_W - SPARK_PADDING * 2;
  const innerH = SPARK_H - SPARK_PADDING * 2;

  const points = ordered.map((r, i) => {
    const x = SPARK_PADDING + (i / (ordered.length - 1)) * innerW;
    const y = SPARK_PADDING + innerH - ((r.score - min) / range) * innerH;
    return [x, y] as const;
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const fillPath =
    `${path} L${points[points.length - 1][0]},${SPARK_H - SPARK_PADDING}` +
    ` L${points[0][0]},${SPARK_H - SPARK_PADDING} Z`;

  return (
    <div className="panel mt-4 relative overflow-hidden">
      <BracketCorners />
      <div className="flex items-baseline justify-between mb-2">
        <span className="eyebrow">Score curve</span>
        <span className="font-mono text-[10px] tracking-[0.2em] text-fg/45">
          last {runs.length}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
        preserveAspectRatio="none"
        width="100%"
        height={SPARK_H}
        aria-hidden
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--neon-cyan)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#spark-fill)" />
        <path
          d={path}
          fill="none"
          stroke="var(--neon-cyan)"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === points.length - 1 ? 3 : 2}
            fill="var(--neon-cyan)"
            opacity={i === points.length - 1 ? 1 : 0.55}
          />
        ))}
      </svg>
    </div>
  );
}

function RunRow({ run, isBest }: { run: RunRecord; isBest: boolean }) {
  return (
    <li className="run-row">
      <span className="run-row__time">{relativeTime(run.endedAt)}</span>
      <span className="run-row__score">
        <span className="font-mono text-base font-semibold tabular-nums text-neon-cyan">
          {run.score.toLocaleString()}
        </span>
        {isBest && run.score > 0 && (
          <span className="run-row__badge" title="Personal best">
            BEST
          </span>
        )}
      </span>
      <span className="run-row__meta">
        <span title={`${(run.durationMs / 1000).toFixed(1)}s alive`}>
          {(run.durationMs / 1000).toFixed(0)}s
        </span>
        <span className="text-fg/30">·</span>
        <span className="text-neon-amber">+{run.coins}</span>
      </span>
    </li>
  );
}

function relativeTime(endedAt: number): string {
  const diff = Date.now() - endedAt;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const date = new Date(endedAt);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
