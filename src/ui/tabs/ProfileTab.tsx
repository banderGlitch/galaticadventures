import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "../../game/store";
import { getUser, hapticImpact, hapticSelection } from "../../telegram/sdk";
import { getPerfTier, setPerfTier, type PerfTier } from "../../lib/perfTier";
import BracketCorners from "../BracketCorners";
import { ApiError, api, getApiOrigin, hasTelegramAuth } from "../../api/client";

const BUILD_LABEL = "0.1 // Phase 4.5";

export default function ProfileTab() {
  const user = getUser();
  const bestScore = useGame((s) => s.bestScore);
  const totalCoins = useGame((s) => s.totalCoins);
  const runsPlayed = useGame((s) => s.runsPlayed);
  const clearStats = useGame((s) => s.clearStats);

  const [tier, setTier] = useState<PerfTier>(getPerfTier());
  const [confirmReset, setConfirmReset] = useState(false);

  /** GET /health only — verifies browser → Railway CORS path (no Telegram header). */
  const [apiProbe, setApiProbe] = useState<{ loading: boolean; ok: boolean; detail: string }>({
    loading: true,
    ok: false,
    detail: "",
  });

  const runHealthProbe = () => {
    setApiProbe((p) => ({ ...p, loading: true }));
    void api
      .health()
      .then((h) => {
        setApiProbe({ loading: false, ok: true, detail: h.status ?? "ok" });
      })
      .catch((e: unknown) => {
        const msg =
          e instanceof ApiError
            ? e.status === 0
              ? `${e.message} (blocked / offline / wrong CORS)`
              : `HTTP ${e.status}`
            : String(e);
        setApiProbe({ loading: false, ok: false, detail: msg });
      });
  };

  useEffect(() => {
    runHealthProbe();
  }, []);

  const onTierChange = (next: PerfTier) => {
    if (next === tier) return;
    hapticSelection();
    setPerfTier(next);
    setTier(next);
  };

  const onResetClick = () => {
    if (!confirmReset) {
      hapticImpact("light");
      setConfirmReset(true);
      // Auto-cancel the confirmation if user looks away.
      window.setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    hapticImpact("heavy");
    clearStats();
    setConfirmReset(false);
  };

  return (
    <motion.section
      key="profile"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28 }}
      className="tab-page"
    >
      <header className="tab-header">
        <span className="tag">
          <span className="tag-dot tag-dot--live" />
          Pilot record
        </span>
        <h2 className="title-wordmark text-3xl mt-2">Profile</h2>
        <p className="eyebrow mt-1">// Sector 7-A clearance</p>
      </header>

      {/* Identity card */}
      <div className="panel mt-5 relative">
        <BracketCorners />
        <div className="flex items-center gap-4">
          <Avatar user={user} />
          <div className="flex-1 min-w-0">
            <div
              className="font-display text-xl font-bold truncate"
              style={{ color: "var(--neon-cyan)", textShadow: "0 0 14px rgba(34,211,238,0.45)" }}
            >
              {user.name}
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-fg/55 truncate">
              {user.username ? `@${user.username}` : `id :: ${user.id || "preview"}`}
            </div>
            {user.language && (
              <div className="font-mono text-[10px] tracking-[0.22em] text-fg/40 mt-1">
                lang :: {user.language}
              </div>
            )}
          </div>
        </div>

        <div className="rule-diamond mt-5">Career</div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Stat label="Best" value={bestScore.toLocaleString()} accent="var(--neon-cyan)" />
          <Stat label="Cores" value={totalCoins.toLocaleString()} accent="var(--neon-amber)" />
          <Stat label="Runs" value={runsPlayed.toLocaleString()} accent="var(--neon-violet)" />
        </div>
      </div>

      {/* Settings card */}
      <div className="panel mt-5 relative">
        <BracketCorners />
        <div className="eyebrow">Performance</div>
        <p className="tagline mt-1 mb-3">
          Bloom postprocessing makes the neon really glow. Drop to{" "}
          <span className="text-fg">Low</span> if your device stutters.
        </p>
        <div className="seg-control" role="radiogroup" aria-label="Performance tier">
          <SegButton
            label="Low"
            sublabel="No bloom"
            active={tier === "low"}
            onClick={() => onTierChange("low")}
          />
          <SegButton
            label="High"
            sublabel="Full bloom"
            active={tier === "high"}
            onClick={() => onTierChange("high")}
          />
        </div>
        <p className="font-mono text-[10px] tracking-[0.22em] text-fg/40 mt-2">
          // takes effect on next page load
        </p>
      </div>

      {/* Danger zone */}
      <div className="panel panel--magenta mt-5 relative">
        <BracketCorners />
        <div className="eyebrow" style={{ color: "var(--neon-rose)" }}>
          Danger zone
        </div>
        <p className="tagline mt-1 mb-3">
          Wipe your local stats: best score, cores, run history.{" "}
          {user.isReal
            ? "Phase 5 server records are not affected."
            : "(Server records will be untouched once Phase 5 ships.)"}
        </p>
        <button
          type="button"
          onClick={onResetClick}
          className={`btn-neon ${confirmReset ? "btn-neon--magenta" : "btn-neon--ghost"}`}
        >
          {confirmReset ? "Tap again to confirm" : "Reset local stats"}
        </button>
      </div>

      {/* API connectivity — verifies Mini App bundle can reach Railway /health */}
      <div className="panel mt-5 relative border border-white/[0.08]">
        <BracketCorners />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="eyebrow">API link · diagnostic</div>
            <p className="tagline mt-1 mb-0">
              Calls <span className="text-fg font-mono text-[11px]">GET /health</span> (no Telegram
              header). If this fails, the game cannot sync scores to the server.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400/90 hover:text-cyan-300"
            onClick={() => {
              hapticSelection();
              runHealthProbe();
            }}
          >
            Retry
          </button>
        </div>
        <dl className="mt-4 space-y-2 font-mono text-[11px] leading-snug">
          <div className="flex justify-between gap-2 text-fg/70">
            <dt className="text-fg/45 uppercase tracking-[0.16em]">Host</dt>
            <dd className="truncate text-right text-cyan-300/95" title={getApiOrigin()}>
              {apiHostLabel(getApiOrigin())}
            </dd>
          </div>
          <div className="flex justify-between gap-2 text-fg/70">
            <dt className="text-fg/45 uppercase tracking-[0.16em]">Reachable</dt>
            <dd>
              {apiProbe.loading ? (
                <span className="text-amber-200/90">checking…</span>
              ) : apiProbe.ok ? (
                <span className="text-emerald-300/95">yes · {apiProbe.detail}</span>
              ) : (
                <span className="text-rose-300/95">{apiProbe.detail}</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-2 text-fg/70">
            <dt className="text-fg/45 uppercase tracking-[0.16em]">initData</dt>
            <dd className={hasTelegramAuth() ? "text-emerald-300/95" : "text-fg/50"}>
              {hasTelegramAuth() ? "present (Telegram sync possible)" : "missing (preview / browser)"}
            </dd>
          </div>
        </dl>
      </div>

      <p className="eyebrow mt-7 mb-2 text-center">
        Asteroid Dodger // Build {BUILD_LABEL}
      </p>
    </motion.section>
  );
}

function apiHostLabel(origin: string): string {
  try {
    const o = origin.startsWith("http") ? origin : `https://${origin}`;
    return new URL(o).host;
  } catch {
    return origin.replace(/^https:\/\//, "").split("/")[0];
  }
}

/* ───────────────────────────  pieces  ─────────────────────────── */

function Avatar({ user }: { user: ReturnType<typeof getUser> }) {
  if (user.photoUrl) {
    return (
      <img
        src={user.photoUrl}
        alt=""
        className="avatar"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="avatar avatar--initials" aria-hidden>
      {initial}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-fg/55">
        {label}
      </span>
      <span
        className="font-mono text-lg font-semibold tabular-nums leading-tight mt-1"
        style={{ color: accent, textShadow: `0 0 12px ${accent}aa` }}
      >
        {value}
      </span>
    </div>
  );
}

function SegButton({
  label,
  sublabel,
  active,
  onClick,
}: {
  label: string;
  sublabel: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`seg-btn${active ? " seg-btn--active" : ""}`}
    >
      <span className="seg-btn__label">{label}</span>
      <span className="seg-btn__sublabel">{sublabel}</span>
    </button>
  );
}
