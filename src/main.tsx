import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initTelegram } from "./telegram/sdk";

initTelegram();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root not found in index.html");
}
createRoot(rootEl).render(<App />);
