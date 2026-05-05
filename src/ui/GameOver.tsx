import { useEffect } from "react";
import { motion } from "framer-motion";
import { useGame } from "../game/store";
import { hapticImpact, hideMainButton, setMainButton } from "../telegram/sdk";
import Stat from "./Stat";
import BracketCorners from "./BracketCorners";

export default function GameOver() {
  const score = useGame((s) => s.score);
  const bestScore = useGame((s) => s.bestScore);
  const totalCoins = useGame((s) => s.totalCoins);
  const lastResult = useGame((s) => s.lastResult);
  const reset = useGame((s) => s.reset);
  const start = useGame((s) => s.start);

  const earned = Math.floor(score / 10);
  // Prefer the server's `newBest` flag when it's available — it considers
  // every device the player has logged in from, not just this one.
  const isBest = lastResult ? lastResult.newBest : score > 0 && score >= bestScore;
  const serverRank = lastResult?.rank ?? null;

  useEffect(() => {
    setMainButton(
      "Re-engage",
      () => {
        hapticImpact("medium");
        start();
      },
      "#f0abfc",
    );
    return () => hideMainButton();
  }, [start]);

  const statusColor = isBest ? "var(--neon-amber)" : "var(--neon-rose)";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
    >
      <div className="synth-horizon" aria-hidden />

      <motion.span
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="tag relative z-10 mb-3"
      >
        <span
          className="tag-dot"
          style={{ background: statusColor, boxShadow: `0 0 10px ${statusColor}` }}
        />
        {isBest ? "New record posted" : "Run terminated"}
      </motion.span>

      <motion.h2
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.45 }}
        className="title-wordmark relative z-10 text-4xl sm:text-5xl"
        data-tone={isBest ? undefined : "magenta"}
      >
        {isBest ? "New Best!" : "Wrecked"}
      </motion.h2>

      <p className="eyebrow relative z-10 mt-3">// Sector 7-A debrief</p>

      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.18, duration: 0.45 }}
        className="panel panel--magenta relative z-10 mt-7"
        data-no-drag
      >
        <BracketCorners />
        <div className="flex items-stretch">
          <Stat label="Score" value={score} accent="var(--neon-cyan)" />
          <div className="mx-2 w-px self-stretch bg-white/10" />
          <Stat label="Best" value={bestScore} accent="var(--neon-violet)" />
          <div className="mx-2 w-px self-stretch bg-white/10" />
          <Stat label="+ Cores" value={earned} accent="var(--neon-amber)" />
        </div>
      </motion.div>

      <p className="tagline relative z-10 mt-5">
        Cores in vault:{" "}
        <span
          className="font-mono font-semibold text-neon-amber"
          style={{ textShadow: "0 0 10px rgba(251,191,36,0.55)" }}
        >
          {totalCoins.toLocaleString()}
        </span>
      </p>

      {serverRank !== null && (
        <motion.p
          initial={{ y: 4, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="eyebrow relative z-10 mt-2"
        >
          Galaxy rank ::{" "}
          <span
            className="font-mono font-semibold"
            style={{ color: "var(--neon-magenta)", textShadow: "0 0 10px rgba(240,171,252,0.5)" }}
          >
            #{serverRank}
          </span>
        </motion.p>
      )}

      <div className="rule-diamond relative z-10 mt-7 w-60">Choose your fate</div>

      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.32, duration: 0.45 }}
        className="relative z-10 mt-5 flex gap-3"
        data-no-drag
      >
        <button
          onClick={() => {
            hapticImpact("medium");
            start();
          }}
          className="btn-neon"
        >
          Re-engage
        </button>
        <button
          onClick={() => {
            hapticImpact("light");
            reset();
          }}
          className="btn-neon btn-neon--ghost"
        >
          Return to base
        </button>
      </motion.div>
    </motion.div>
  );
}
