import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useGame } from "./store";

const TICK_SECONDS = 0.1;
const POINTS_PER_TICK = 1;

export default function GameLoop() {
  const acc = useRef(0);

  useFrame((_, deltaRaw) => {
    if (useGame.getState().phase !== "playing") {
      acc.current = 0;
      return;
    }
    acc.current += Math.min(deltaRaw, 0.05);
    if (acc.current >= TICK_SECONDS) {
      const ticks = Math.floor(acc.current / TICK_SECONDS);
      acc.current -= ticks * TICK_SECONDS;
      useGame.getState().addScore(ticks * POINTS_PER_TICK);
    }
  });

  return null;
}
