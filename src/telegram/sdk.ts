/**
 * Thin wrapper around the Telegram Mini App SDK (`window.Telegram.WebApp`).
 *
 * The SDK is loaded by the <script> tag in index.html, so it's available
 * synchronously by the time React mounts. Outside of Telegram (e.g. plain
 * `npm run dev` in a browser tab) `window.Telegram` is undefined, so every
 * helper here gracefully no-ops and the game still runs in "standalone"
 * preview mode.
 */

const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;

let lastMainCallback: (() => void) | null = null;

export function initTelegram(): void {
  if (!tg) return;
  tg.ready();
  tg.expand();
  applyThemeVars();
  tg.onEvent("themeChanged", applyThemeVars);
}

function applyThemeVars(): void {
  if (!tg) return;
  const params = tg.themeParams ?? {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      const cssVar = `--tg-${key.replace(/_/g, "-")}`;
      document.documentElement.style.setProperty(cssVar, value);
    }
  }
}

export function getUserName(): string {
  return tg?.initDataUnsafe?.user?.first_name ?? "Pilot";
}

export type TelegramUser = {
  /** Telegram user id, or 0 in standalone preview. */
  id: number;
  /** Display name (first + last when present). */
  name: string;
  /** Public @username if set, otherwise null. */
  username: string | null;
  /** photo_url is only populated by some clients; null elsewhere. */
  photoUrl: string | null;
  /** Two-letter ISO code or null. */
  language: string | null;
  /** True when running embedded in a real Telegram client. */
  isReal: boolean;
};

export function getUser(): TelegramUser {
  const u = tg?.initDataUnsafe?.user;
  if (!u) {
    return {
      id: 0,
      name: "Pilot",
      username: null,
      photoUrl: null,
      language: null,
      isReal: false,
    };
  }
  const last = (u as { last_name?: string }).last_name;
  return {
    id: u.id,
    name: last ? `${u.first_name} ${last}` : u.first_name,
    username: u.username ?? null,
    photoUrl: (u as { photo_url?: string }).photo_url ?? null,
    language: (u as { language_code?: string }).language_code ?? null,
    isReal: true,
  };
}

export function isInTelegram(): boolean {
  return Boolean(tg);
}

export function hapticSelection(): void {
  if (!tg) return;
  if (!isVersionAtLeast(tg.version, "6.1")) return;
  tg.HapticFeedback?.selectionChanged();
}

export function hapticImpact(style: "light" | "medium" | "heavy" = "medium"): void {
  if (!tg) return;
  // HapticFeedback was introduced in Bot API 6.1; older clients log an error
  // when the method is invoked even though the object exists.
  if (!isVersionAtLeast(tg.version, "6.1")) return;
  tg.HapticFeedback?.impactOccurred(style);
}

export function hapticNotification(type: "error" | "success" | "warning"): void {
  if (!tg) return;
  if (!isVersionAtLeast(tg.version, "6.1")) return;
  tg.HapticFeedback?.notificationOccurred(type);
}

export function setMainButton(
  text: string,
  onClick: () => void,
  color: string = "#22d3ee",
): void {
  if (!tg) return;
  tg.MainButton.setText(text);
  tg.MainButton.setParams({
    color,
    text_color: "#06141d",
    is_active: true,
    is_visible: true,
  });
  if (lastMainCallback) tg.MainButton.offClick(lastMainCallback);
  lastMainCallback = onClick;
  tg.MainButton.onClick(onClick);
  tg.MainButton.show();
}

export function hideMainButton(): void {
  if (!tg) return;
  if (lastMainCallback) {
    tg.MainButton.offClick(lastMainCallback);
    lastMainCallback = null;
  }
  tg.MainButton.hide();
}

/**
 * Stops the user from accidentally closing the Mini App with a vertical
 * swipe-down gesture while the game is running. Available in Bot API 7.7+;
 * older clients log an error if we call it, so we feature-detect by version.
 */
export function disableSwipes(disable: boolean): void {
  if (!tg) return;
  if (!isVersionAtLeast(tg.version, "7.7")) return;

  type MaybeSwipes = {
    disableVerticalSwipes?: () => void;
    enableVerticalSwipes?: () => void;
  };
  const ext = tg as unknown as MaybeSwipes;
  if (disable) ext.disableVerticalSwipes?.();
  else ext.enableVerticalSwipes?.();
}

function isVersionAtLeast(current: string | undefined, required: string): boolean {
  if (!current) return false;
  const a = current.split(".").map((n) => parseInt(n, 10) || 0);
  const b = required.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return true;
}
