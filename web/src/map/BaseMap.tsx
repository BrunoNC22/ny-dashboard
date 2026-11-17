import "maplibre-gl/dist/maplibre-gl.css";

import { setWorkerUrl } from "maplibre-gl";
// MapLibre 6 resolves its worker relative to its own module URL, which Vite's dependency
// pre-bundling moves: point it at the real file (served in dev, emitted as an asset in build).
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { type ReactNode, useEffect, useRef } from "react";
import {
  AttributionControl,
  Map,
  type MapRef,
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
  /**
   * Ctrl/⌘ + wheel to zoom and two fingers to pan on touch, so a map inside a scrolling page
   * does not capture the page scroll (dashboard widgets).
   */
  cooperativeGestures?: boolean;
}

/**
 * Themed MapLibre basemap (OpenFreeMap) with attribution and zoom controls. If the basemap
 * cannot be loaded (offline), the data layers still render over a plain background.
 */
export function BaseMap({
  children,
  pitch = 0,
  className,
  cooperativeGestures = false,
}: BaseMapProps) {
  const { theme, style } = useMapTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);
  // Grid items resize without a window resize: follow the container.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
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
    <div
      ref={containerRef}
      className={className ?? "h-full w-full overflow-hidden rounded-xl"}
    >
      <Map
        ref={mapRef}
        cooperativeGestures={cooperativeGestures}
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
