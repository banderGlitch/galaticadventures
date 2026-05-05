/**
 * Wreckage event bus. Decouples the collision detector (which knows _where_)
 * from the visual effect component (which knows _how_).
 *
 * We intentionally don't push wreckage through Zustand: this is a one-shot
 * imperative trigger, not state. Wedging it into the store would force an
 * unnecessary re-render and complicate the "spawn N pooled chunks" flow.
 */

export type WreckageListener = (x: number, y: number, z: number) => void;

const listeners = new Set<WreckageListener>();

export function emitWreckage(x: number, y: number, z: number): void {
  for (const fn of listeners) fn(x, y, z);
}

export function onWreckage(fn: WreckageListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
