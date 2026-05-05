import { create } from "zustand";

export type Tab = "play" | "stats" | "leaderboard" | "profile";

type NavState = {
  tab: Tab;
  setTab: (tab: Tab) => void;
};

export const useNav = create<NavState>((set) => ({
  tab: "play",
  setTab: (tab) => set({ tab }),
}));
