import { useEffect } from "react";
import { motion } from "framer-motion";
import { useGame } from "../game/store";
import {
  getUserName,
  hapticImpact,
  hideMainButton,
  isInTelegram,
  setMainButton,
} from "../telegram/sdk";
import Stat from "./Stat";
import BracketCorners from "./BracketCorners";

export default function StartScreen() {
  const start = useGame((s) => s.start);
  const bestScore = useGame((s) => s.bestScore);
  const totalCoins = useGame((s) => s.totalCoins);
  const name = getUserName();

  useEffect(() => {
    setMainButton("Engage", () => {
      hapticImpact("medium");
      start();
    });
    return () => hideMainButton();
  }, [start]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45 }}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center pointer-events-none"
    >
      <div className="synth-horizon" aria-hidden />

      <motion.div
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.45 }}
        className="relative z-10 mb-3"
      >
        <span className="tag">
          <span className="tag-dot tag-dot--live" />
          Mission // Sector 7-A
        </span>
      </motion.div>

      <motion.h1
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="title-wordmark relative z-10 text-5xl sm:text-6xl"
      >
        Asteroid Dodger
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.45 }}
        className="eyebrow relative z-10 mt-3"
      >
        &gt;&gt; CMDR <span className="text-fg">{name}</span> :: standby
      </motion.p>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.32, duration: 0.45 }}
        className="panel pointer-events-auto relative z-10 mt-9"
        data-no-drag
      >
        <BracketCorners />
        <div className="flex items-stretch">
          <Stat label="Best run" value={bestScore} accent="var(--neon-cyan)" />
          <div className="mx-2 w-px self-stretch bg-white/10" />
          <Stat label="Cores" value={totalCoins} accent="var(--neon-amber)" />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.42, duration: 0.45 }}
        className="tagline relative z-10 mt-9 max-w-xs"
      >
        Drag anywhere to fly. Slip the asteroid storm. Snag glowing cores along
        the way.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.45 }}
        className="rule-diamond relative z-10 mt-7 w-60"
      >
        Pre-flight check
      </motion.div>

      <motion.button
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        data-no-drag
        onClick={() => {
          hapticImpact("medium");
          start();
        }}
        className="btn-neon pointer-events-auto relative z-10 mt-5"
      >
        {isInTelegram() ? "Engage" : "Engage (preview)"}
      </motion.button>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="relative z-10 mt-7 flex flex-wrap items-center justify-center gap-2"
      >
        <span className="tag">[ Drag ] Fly</span>
        <span className="tag">[ Avoid ] Rocks</span>
        <span className="tag">[ Collect ] Cores</span>
      </motion.div>

      {!isInTelegram() && (
        <p className="font-mono relative z-10 mt-6 text-xs text-fg/40">
          Running outside Telegram — haptics &amp; main button are disabled.
        </p>
      )}
    </motion.div>
  );
}
