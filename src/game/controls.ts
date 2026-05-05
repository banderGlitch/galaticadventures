import { useEffect } from "react";
import { useGame } from "./store";
import { ShipTarget, PLAY_HALF_W, PLAY_HALF_H } from "./refs";

const DRAG_SENSITIVITY_X = 12; // virtual world units per full-width drag
const DRAG_SENSITIVITY_Y = 8;
const KEY_STEP = 0.7;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Drag-anywhere XY controls + keyboard fallback.
 *
 * Touch / mouse: relative drag. Keep finger anywhere on screen and move it
 * around — the ship's target offsets by the same screen-fraction the finger
 * has travelled since touch-down.
 *
 * Keyboard: WASD / arrows nudge the ship a fixed step per keypress.
 *
 * Listeners are global (window) but gated by `phase === "playing"` so they
 * never interfere with menu UI.
 */
export function useControls(): void {
  useEffect(() => {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startTargetX = 0;
    let startTargetY = 0;

    function onPointerDown(e: PointerEvent) {
      if (useGame.getState().phase !== "playing") return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target as Element | null;
      if (target?.closest?.("[data-no-drag]")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startTargetX = ShipTarget.x;
      startTargetY = ShipTarget.y;
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      const w = Math.max(window.innerWidth, 1);
      const h = Math.max(window.innerHeight, 1);
      const dx = (e.clientX - startX) / w;
      const dy = (e.clientY - startY) / h;
      ShipTarget.x = clamp(
        startTargetX + dx * DRAG_SENSITIVITY_X,
        -PLAY_HALF_W,
        PLAY_HALF_W,
      );
      // Screen Y grows downward; world Y grows upward — so invert.
      ShipTarget.y = clamp(
        startTargetY - dy * DRAG_SENSITIVITY_Y,
        -PLAY_HALF_H,
        PLAY_HALF_H,
      );
    }

    function onPointerUp() {
      dragging = false;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (useGame.getState().phase !== "playing") return;
      const key = e.key.toLowerCase();
      let handled = true;
      if (key === "arrowleft" || key === "a") {
        ShipTarget.x = clamp(ShipTarget.x - KEY_STEP, -PLAY_HALF_W, PLAY_HALF_W);
      } else if (key === "arrowright" || key === "d") {
        ShipTarget.x = clamp(ShipTarget.x + KEY_STEP, -PLAY_HALF_W, PLAY_HALF_W);
      } else if (key === "arrowup" || key === "w") {
        ShipTarget.y = clamp(ShipTarget.y + KEY_STEP, -PLAY_HALF_H, PLAY_HALF_H);
      } else if (key === "arrowdown" || key === "s") {
        ShipTarget.y = clamp(ShipTarget.y - KEY_STEP, -PLAY_HALF_H, PLAY_HALF_H);
      } else {
        handled = false;
      }
      if (handled) e.preventDefault();
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
