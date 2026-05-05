import { hapticSelection } from "../telegram/sdk";
import { useNav, type Tab } from "./nav";

/**
 * Bottom tab bar — the mobile-app frame for the whole product.
 *
 * Visibility is governed by the parent (`App.tsx`); this component renders
 * itself unconditionally. We hide the bar during gameplay (`playing`/
 * `exploding`) so the action is unobstructed.
 */

type TabSpec = {
  id: Tab;
  label: string;
  icon: JSX.Element;
};

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const TABS: TabSpec[] = [
  {
    id: "play",
    label: "Play",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M7 5l12 7-12 7V5z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "stats",
    label: "Stats",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M4 19V11" />
        <path d="M10 19V5" />
        <path d="M16 19v-6" />
        <path d="M22 19V8" />
      </svg>
    ),
  },
  {
    id: "leaderboard",
    label: "Ranks",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M8 4h8v4a4 4 0 11-8 0V4z" />
        <path d="M5 4H3v2a3 3 0 003 3" />
        <path d="M19 4h2v2a3 3 0 01-3 3" />
        <path d="M9 20h6" />
        <path d="M12 14v6" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Profile",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

export default function TabBar() {
  const tab = useNav((s) => s.tab);
  const setTab = useNav((s) => s.setTab);

  return (
    <nav className="tab-bar" aria-label="Primary navigation">
      <div className="tab-bar__inner">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`tab-btn${active ? " tab-btn--active" : ""}`}
              aria-current={active ? "page" : undefined}
              aria-label={t.label}
              onClick={() => {
                if (active) return;
                hapticSelection();
                setTab(t.id);
              }}
            >
              <span className="tab-btn__icon">{t.icon}</span>
              <span className="tab-btn__label">{t.label}</span>
              {active && <span className="tab-btn__indicator" aria-hidden />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
