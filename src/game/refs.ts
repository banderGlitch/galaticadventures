/**
 * "Hot" mutable state shared between input handlers and the r3f frame loop.
 *
 * We deliberately keep ship position / target out of the zustand store: they
 * change every frame, and routing them through React state would trigger
 * needless re-renders. Pure mutable references give us 60 fps without churn.
 */

import { Vector3 } from "three";

export const ShipPosition = new Vector3(0, 0, 0);
export const ShipTarget = new Vector3(0, 0, 0);

export const PLAY_HALF_W = 5.5;
export const PLAY_HALF_H = 3.5;

export function resetShip(): void {
  ShipPosition.set(0, 0, 0);
  ShipTarget.set(0, 0, 0);
}
