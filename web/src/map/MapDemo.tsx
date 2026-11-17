import { ArcLayer, GeoJsonLayer } from "@deck.gl/layers";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Card, SegmentedControl } from "../components/ui";
import { BaseMap } from "./BaseMap";
import { DeckOverlay } from "./DeckOverlay";
import {
  arcColors,
  divergingColor,
  divergingLegend,
  quantileColorScale,
  zoneLineColor,
} from "./mapTheme";
import { useMapTheme } from "./useMapTheme";

interface ZoneFeature {
  type: "Feature";
  id: number;
  geometry: unknown;
  properties: { locationId: number; zone: string; centroid: [number, number] };
}

/** Deterministic fake value per zone, only for the showcase. */
const fake = (id: number) => ((id * 7919) % 997) ** 1.6;
const fakeDelta = (id: number) => ((id * 37) % 61) - 30;

/** Dev-only showcase of the map theme (rendered on /_ds; needs the API for /api/zones). */
export function MapDemo() {
  const { theme, palette } = useMapTheme();
  const [mode, setMode] = useState<"value" | "delta">("value");
  const zones = useQuery({
    queryKey: ["zones-geojson"],
    queryFn: async () =>
      (await (await fetch("/api/zones")).json()) as { features: ZoneFeature[] },
    staleTime: Infinity,
  });
  const features = zones.data?.features ?? [];
  const scale = quantileColorScale(
    features.map((f) => fake(f.id)),
    theme,
  );
  const byId = new Map(features.map((f) => [f.id, f]));
  const flows = [
    [132, 161],
    [138, 230],
    [161, 79],
    [237, 132],
    [76, 76],
  ].flatMap(([from = 0, to = 0]) => {
    const a = byId.get(from)?.properties.centroid;
    const b = byId.get(to)?.properties.centroid;
    return a && b && from !== to ? [{ from: a, to: b }] : [];
  });
  const arcs = arcColors(palette, theme);

  return (
    <Card
      title="Mapa: zonas, comparação e rotas"
      className="h-[28rem]"
      actions={
        <SegmentedControl
          label="Modo"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "value", label: "Valor" },
            { value: "delta", label: "Variação" },
          ]}
        />
      }
    >
      <div className="relative h-full">
        <BaseMap>
          <DeckOverlay
            layers={[
              new GeoJsonLayer<ZoneFeature["properties"]>({
                id: "zones",
                data: features as never,
                filled: true,
                stroked: true,
                getFillColor: (f) =>
                  mode === "value"
                    ? scale.colorOf(fake(f.properties.locationId))
                    : divergingColor(
                        fakeDelta(f.properties.locationId),
                        "higher_is_better",
                        theme,
                      ),
                getLineColor: zoneLineColor(theme),
                lineWidthMinPixels: 0.5,
                updateTriggers: { getFillColor: [mode, theme, palette] },
              }),
              new ArcLayer<{ from: [number, number]; to: [number, number] }>({
                id: "arcs",
                data: flows,
                getSourcePosition: (d) => d.from,
                getTargetPosition: (d) => d.to,
                getSourceColor: arcs.source,
                getTargetColor: arcs.target,
                getWidth: 3,
                getHeight: 0.6,
                updateTriggers: {
                  getSourceColor: [theme, palette],
                  getTargetColor: [theme, palette],
                },
              }),
            ]}
          />
        </BaseMap>
        <div className="glass absolute bottom-3 left-3 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-ink-2">
          {mode === "value" ? (
            <>
              <span>menos</span>
              {scale.colors.map((color) => (
                <span
                  key={color}
                  className="h-2.5 w-4 rounded-sm"
                  style={{ background: color }}
                />
              ))}
              <span>mais</span>
            </>
          ) : (
            <>
              <span>piora</span>
              {divergingLegend(theme).map((color) => (
                <span
                  key={color}
                  className="h-2.5 w-4 rounded-sm"
                  style={{ background: color }}
                />
              ))}
              <span>melhora</span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
