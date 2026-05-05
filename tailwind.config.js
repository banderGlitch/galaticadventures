/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        fg: "var(--fg)",
        "fg-dim": "var(--fg-dim)",
        "fg-mute": "var(--fg-mute)",
        neon: {
          cyan: "var(--neon-cyan)",
          magenta: "var(--neon-magenta)",
          violet: "var(--neon-violet)",
          amber: "var(--neon-amber)",
          rose: "var(--neon-rose)",
        },
      },
      fontFamily: {
        display: ['"Orbitron"', "ui-sans-serif", "system-ui", "sans-serif"],
        body: ['"Space Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
