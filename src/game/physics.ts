import { ShipPosition } from "./refs";

const SHIP_RADIUS = 0.45;

/** Width (in world units) of the "phew, that was close" band around the
 *  collision boundary that counts as a near-miss. Smaller = stricter. */
const NEAR_MISS_GAP = 0.7;

export function checkShipCollision(
  asteroidX: number,
  asteroidY: number,
  asteroidRadius: number,
): boolean {
  const dx = ShipPosition.x - asteroidX;
  const dy = ShipPosition.y - asteroidY;
  const distSq = dx * dx + dy * dy;
  const r = SHIP_RADIUS + asteroidRadius * 0.85;
  return distSq < r * r;
}

/**
 * Returns true when the asteroid is just outside the collision boundary —
 * i.e. it brushed past the ship without actually hitting. Should be evaluated
 * exactly once per asteroid, on the frame it crosses the ship plane.
 */
export function checkShipNearMiss(
  asteroidX: number,
  asteroidY: number,
  asteroidRadius: number,
): boolean {
  const dx = ShipPosition.x - asteroidX;
  const dy = ShipPosition.y - asteroidY;
  const distSq = dx * dx + dy * dy;
  const collisionR = SHIP_RADIUS + asteroidRadius * 0.85;
  const missR = collisionR + NEAR_MISS_GAP;
  return distSq >= collisionR * collisionR && distSq < missR * missR;
}

/**
 * Sphere-in-sphere check used by coin pickups; takes an explicit radius rather
 * than scaling because coins are small and forgiving.
 */
export function checkPickup(
  itemX: number,
  itemY: number,
  pickupRadius: number,
): boolean {
  const dx = ShipPosition.x - itemX;
  const dy = ShipPosition.y - itemY;
  const distSq = dx * dx + dy * dy;
  return distSq < pickupRadius * pickupRadius;
}
