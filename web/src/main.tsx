import "./styles/index.css";

import {
  type Palette,
  PALETTES,
  type Theme,
  THEMES,
} from "@ny-dashboard/shared";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { usePreferencesStore } from "./stores/preferencesStore";

// Dev convenience: ?theme=light&palette=sunset wins over saved preferences (screenshots).
if (import.meta.env.DEV) {
  const params = new URLSearchParams(window.location.search);
  const theme = params.get("theme");
  const palette = params.get("palette");
  if (theme !== null || palette !== null) {
    const current = usePreferencesStore.getState().preferences;
    usePreferencesStore.getState().lock({
      theme: (THEMES as readonly string[]).includes(theme ?? "")
        ? (theme as Theme)
        : current.theme,
      palette: (PALETTES as readonly string[]).includes(palette ?? "")
        ? (palette as Palette)
        : current.palette,
    });
  }
}

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
