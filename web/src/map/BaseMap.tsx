import "maplibre-gl/dist/maplibre-gl.css";

import { setWorkerUrl } from "maplibre-gl";
// MapLibre 6 resolves its worker relative to its own module URL, which Vite's dependency
// pre-bundling moves: point it at the real file (served in dev, emitted as an asset in build).
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import type { ReactNode } from "react";
import {
  AttributionControl,
  Map,
  NavigationControl,
} from "react-map-gl/maplibre";

import { BASE } from "../styles/tokens";
import { MAP_ATTRIBUTION, NYC_VIEW } from "./mapTheme";
import { useMapTheme } from "./useMapTheme";

setWorkerUrl(workerUrl);

export interface BaseMapProps {
  children?: ReactNode;
  /** Tilted 3D view (hexagons). */
  pitch?: number;
  className?: string;
}

/**
 * Themed MapLibre basemap (OpenFreeMap) with attribution and zoom controls. If the basemap
 * cannot be loaded (offline), the data layers still render over a plain background.
 */
export function BaseMap({ children, pitch = 0, className }: BaseMapProps) {
  const { theme, style } = useMapTheme();
  const fallback = {
    version: 8 as const,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background" as const,
        paint: { "background-color": BASE[theme].page },
      },
    ],
  };
  return (
    <div className={className ?? "h-full w-full overflow-hidden rounded-xl"}>
      <Map
        initialViewState={{ ...NYC_VIEW, pitch }}
        mapStyle={style ?? fallback}
        attributionControl={false}
        dragRotate={pitch > 0}
        style={{ width: "100%", height: "100%" }}
      >
        <AttributionControl
          compact
          customAttribution={MAP_ATTRIBUTION}
          position="bottom-right"
        />
        <NavigationControl showCompass={pitch > 0} position="top-right" />
        {children}
      </Map>
    </div>
  );
}
