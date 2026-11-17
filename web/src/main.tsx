import "./styles/index.css";

import { PALETTES, THEMES } from "@ny-dashboard/shared";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

// Dev convenience: ?theme=light&palette=sunset applies before the first paint (screenshots).
if (import.meta.env.DEV) {
  const params = new URLSearchParams(window.location.search);
  const theme = params.get("theme");
  const palette = params.get("palette");
  if (theme && (THEMES as readonly string[]).includes(theme)) {
    document.documentElement.dataset.theme = theme;
  }
  if (palette && (PALETTES as readonly string[]).includes(palette)) {
    document.documentElement.dataset.palette = palette;
  }
}

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
