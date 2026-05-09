import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ApiError, api, hasTelegramAuth } from "./api/client";
import { initTelegram } from "./telegram/sdk";

initTelegram();

// Upsert the player row as soon as the Mini App opens inside Telegram (before
// their first /runs/start). Identity still comes from signed initData — not URL
// params from the bot.
if (typeof window !== "undefined" && hasTelegramAuth()) {
  void api.me().catch((err: unknown) => {
    if (err instanceof ApiError && err.status !== 0) {
      console.warn("[api] bootstrap /api/me failed:", err.status, err.body);
    }
  });
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root not found in index.html");
}
createRoot(rootEl).render(<App />);
