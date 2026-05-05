import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { getUser } from "../../telegram/sdk";
import { useLeaderboard } from "../../api/hooks";
import { api } from "../../api/client";
import BracketCorners from "../BracketCorners";

/**
 * Leaderboard tab.
 *
 *   • When the API is reachable we render real, server-verified scores.
 *   • When it isn't (offline, backend down, dev preview without a server),
 *     we fall back to the seeded "rivals" list with the player slotted in
 *     by best score so the layout stays populated.
 */

type Row = {
  rank: number;
  name: string;
  score: number;
  self: boolean;
  /** True for the seeded mock rivals; lets us subtly mark them. */
  ghost: boolean;
};

const MOCK_RIVALS: { name: string; score: number }[] = [
  { name: "Vega-09", score: 12_840 },
  { name: "Hex.runner", score: 9_220 },
  { name: "Kira", score: 7_805 },
  { name: "n0vacore", score: 6_410 },
  { name: "Surge.II", score: 5_120 },
  { name: "atlas_77", score: 4_280 },
  { name: "Echo", score: 3_140 },
  { name: "Drift", score: 2_660 },
  { name: "PixelMonk", score: 2_010 },
  { name: "Rin", score: 1_540 },
  { name: "JOLT", score: 980 },
  { name: "lyra", score: 720 },
];

export default function LeaderboardTab() {
  const { data, loading, error } = useLeaderboard(50);
  const localBest = useGame((s) => s.bestScore);
  const user = getUser();

  const usingServer = data !== null && error === null;

  const rows: Row[] = usingServer
    ? data!.entries.map((e) => ({
        rank: e.rank,
        name: e.name,
        score: e.score,
        self: e.isSelf,
        ghost: false,
      }))
    : buildLocalRows(localBest, user.name);

  const playerRank = usingServer
    ? data?.selfRank ?? rows.find((r) => r.self)?.rank ?? null
    : rows.find((r) => r.self)?.rank ?? null;

  const playerScore = usingServer
    ? data?.entries.find((e) => e.isSelf)?.score ?? localBest
    : localBest;

  return (
    <motion.section
      key="leaderboard"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28 }}
      className="tab-page"
    >
      <header className="tab-header">
        <span className="tag">
          <SourceDot loading={loading} usingServer={usingServer} />
          {loading ? "Syncing" : usingServer ? "Live ranks" : "Offline ranks"}
        </span>
        <h2 className="title-wordmark text-3xl mt-2">Leaderboard</h2>
        <p className="eyebrow mt-1">// Sector 7-A standings</p>
      </header>

      {playerRank !== null && (
        <div className="panel panel--magenta mt-5 relative">
          <BracketCorners />
          <div className="flex items-center justify-between">
            <div>
              <span className="eyebrow">Your rank</span>
              <div
                className="font-display text-3xl font-bold mt-1"
                style={{
                  color: "var(--neon-magenta)",
                  textShadow: "0 0 18px rgba(240,171,252,0.5)",
                }}
              >
                #{playerRank}
              </div>
            </div>
            <div className="text-right">
              <span className="eyebrow">Best</span>
              <div
                className="font-mono text-2xl font-semibold tabular-nums mt-1"
                style={{
                  color: "var(--neon-cyan)",
                  textShadow: "0 0 12px rgba(34,211,238,0.55)",
                }}
              >
                {playerScore.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      <ol className="ranks-list mt-6">
        {rows.length === 0 ? (
          <li className="panel mt-2 text-center">
            <p className="tagline">
              No scores logged yet. Be the first into the asteroid storm.
            </p>
          </li>
        ) : (
          rows.map((row) => (
            <li
              key={`${row.rank}:${row.name}`}
              className={`rank-row${row.self ? " rank-row--self" : ""}`}
            >
              <span
                className={`rank-row__pos${row.rank <= 3 ? ` rank-row__pos--top${row.rank}` : ""}`}
              >
                {row.rank.toString().padStart(2, "0")}
              </span>
              <span className="rank-row__name">{row.name}</span>
              <span className="rank-row__score">{row.score.toLocaleString()}</span>
            </li>
          ))
        )}
      </ol>

      {!usingServer && !loading && (
        <>
          <div className="rule-diamond mt-7">Offline</div>
          <p className="tagline mt-3 text-center">
            Showing seeded ghosts and your local best. Connect to the backend
            to see live ranks.
          </p>
          {error && !api.isLocal() && (
            <p className="eyebrow mt-2 text-center text-fg/50">
              // {error.status || "network"} :: backend unreachable
            </p>
          )}
        </>
      )}
    </motion.section>
  );
}

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
  if (usingServer) {
    return <span className="tag-dot" style={{ background: "var(--neon-amber)" }} />;
  }
  return <span className="tag-dot" style={{ background: "var(--fg-mute)" }} />;
}

function buildLocalRows(playerBest: number, playerName: string): Row[] {
  const merged = MOCK_RIVALS.map((r) => ({
    name: r.name,
    score: r.score,
    self: false,
    ghost: true,
  }));
  const playerEntry = {
    name: playerName,
    score: playerBest,
    self: true,
    ghost: false,
  };

  let inserted = false;
  const out: typeof merged = [];
  for (const r of merged) {
    if (!inserted && playerBest >= r.score) {
      out.push(playerEntry);
      inserted = true;
    }
    out.push(r);
  }
  if (!inserted) out.push(playerEntry);

  return out.map((r, i) => ({ ...r, rank: i + 1 }));
}
