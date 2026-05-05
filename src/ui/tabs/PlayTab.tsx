import { AnimatePresence } from "framer-motion";
import { useGame } from "../../game/store";
import StartScreen from "../StartScreen";
import Hud from "../Hud";
import GameOver from "../GameOver";

/**
 * Play tab — owns the StartScreen / Hud / GameOver flow that the rest of the
 * app already understood. The 3D `<Scene />` is rendered by `App.tsx` because
 * we want it visible behind every tab (a faint, calm starfield is the brand).
 */
export default function PlayTab() {
  const phase = useGame((s) => s.phase);

  return (
    <AnimatePresence mode="wait">
      {phase === "idle" && <StartScreen key="start" />}
      {(phase === "playing" || phase === "exploding") && <Hud key="hud" />}
      {phase === "gameover" && <GameOver key="over" />}
    </AnimatePresence>
  );
}
