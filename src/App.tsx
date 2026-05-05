import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import Scene from "./game/Scene";
import ToastLayer from "./ui/ToastLayer";
import TabBar from "./ui/TabBar";
import PlayTab from "./ui/tabs/PlayTab";
import StatsTab from "./ui/tabs/StatsTab";
import LeaderboardTab from "./ui/tabs/LeaderboardTab";
import ProfileTab from "./ui/tabs/ProfileTab";
import { useGame } from "./game/store";
import { useEvents } from "./game/events";
import { useNav } from "./ui/nav";
import { useControls } from "./game/controls";
import { disableSwipes, hideMainButton } from "./telegram/sdk";

export default function App() {
  const phase = useGame((s) => s.phase);
  const tab = useNav((s) => s.tab);
  useControls();

  // Hide the tab bar during the action so the player isn't tempted to navigate
  // away mid-run and so the bottom edge stays clear for visual effects.
  const inAction = phase === "playing" || phase === "exploding";
  const tabBarVisible = !inAction;

  useEffect(() => {
    // Off-tab → no Telegram MainButton, no swipe lock, ever.
    if (tab !== "play") {
      hideMainButton();
      disableSwipes(false);
      return;
    }

    if (phase === "playing") {
      // Fresh slate: drop any toasts left over from the previous run.
      useEvents.getState().clear();
      disableSwipes(true);
      hideMainButton();
    } else {
      disableSwipes(false);
    }
    return () => {
      disableSwipes(false);
    };
  }, [phase, tab]);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden vignette scanlines">
      <Scene />
      <ToastLayer />

      <main className={`stage${tabBarVisible ? " stage--with-bar" : ""}`}>
        <AnimatePresence mode="wait">
          {tab === "play" && <PlayTab key="play" />}
          {tab === "stats" && <StatsTab key="stats" />}
          {tab === "leaderboard" && <LeaderboardTab key="leaderboard" />}
          {tab === "profile" && <ProfileTab key="profile" />}
        </AnimatePresence>
      </main>

      {tabBarVisible && <TabBar />}
    </div>
  );
}
