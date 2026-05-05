/**
 * Transient gameplay events that drive UI feedback (floating "+50" / "+10"
 * toasts). Kept separate from the main game store so the HUD never re-renders
 * on toast churn.
 *
 * Each toast has a unique numeric id and self-removes after the ToastLayer's
 * timeout, so the array stays bounded even if events fire rapidly.
 */

import { create } from "zustand";

export type ToastKind = "coin" | "miss";

export type Toast = {
  id: number;
  value: number;
  kind: ToastKind;
};

interface EventsState {
  toasts: Toast[];
  push: (kind: ToastKind, value: number) => void;
  remove: (id: number) => void;
  clear: () => void;
}

let nextId = 1;

export const useEvents = create<EventsState>((set) => ({
  toasts: [],
  push: (kind, value) =>
    set((s) => ({ toasts: [...s.toasts, { id: nextId++, kind, value }] })),
  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
