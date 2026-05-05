import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEvents, type Toast } from "../game/events";

/** How long a toast stays in the DOM before being garbage-collected. Should
 *  be slightly longer than the framer-motion exit transition so the leaving
 *  animation finishes cleanly. */
const LIFETIME_MS = 850;

export default function ToastLayer() {
  const toasts = useEvents((s) => s.toasts);

  return (
    <div className="absolute inset-x-0 top-20 z-20 flex justify-center pointer-events-none">
      <div className="relative h-32 w-full max-w-sm">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const remove = useEvents((s) => s.remove);

  useEffect(() => {
    const timer = setTimeout(() => remove(toast.id), LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [remove, toast.id]);

  const isCoin = toast.kind === "coin";
  const accent = isCoin ? "var(--neon-amber)" : "var(--neon-cyan)";
  // Deterministic horizontal jitter (-40..40 px) so simultaneous toasts spread
  // out instead of stacking on top of each other.
  const jitterX = ((toast.id * 137) % 80) - 40;

  return (
    <motion.div
      // x is supplied as a string percentage so framer-motion centers the
      // element (it owns the `transform` CSS property and would otherwise
      // overwrite any inline transform we set).
      initial={{ x: "-50%", y: 32, opacity: 0, scale: 0.7 }}
      animate={{ x: "-50%", y: -16, opacity: 1, scale: 1 }}
      exit={{ x: "-50%", y: -68, opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="absolute flex items-baseline gap-1 font-bold tabular-nums whitespace-nowrap"
      style={{
        left: `calc(50% + ${jitterX}px)`,
        color: accent,
        textShadow: `0 0 14px ${accent}, 0 0 28px ${accent}`,
      }}
    >
      <span className="text-3xl leading-none">+{toast.value}</span>
      {!isCoin && (
        <span className="text-[10px] uppercase tracking-[0.22em] opacity-80">
          near miss
        </span>
      )}
    </motion.div>
  );
}
