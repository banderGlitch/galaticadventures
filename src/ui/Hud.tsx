import { useGame } from "../game/store";

const SCORE_PAD = 6;

function padScore(value: number): string {
  return Math.max(0, Math.floor(value)).toString().padStart(SCORE_PAD, "0");
}

export default function Hud() {
  const score = useGame((s) => s.score);

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
      <div
        className="panel panel--tight flex items-center gap-4"
        data-no-drag
      >
        <span className="flex items-center gap-2">
          <span className="tag-dot tag-dot--live" />
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-fg/55">
            Score
          </span>
        </span>
        <span
          className="font-mono text-2xl font-semibold tabular-nums text-neon-cyan"
          style={{ textShadow: "0 0 12px rgba(34,211,238,0.65)" }}
        >
          {padScore(score)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-fg/40">
          / S7A
        </span>
      </div>
    </div>
  );
}
