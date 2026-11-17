import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";
import { useControl } from "react-map-gl/maplibre";

/**
 * deck.gl layers over the MapLibre basemap (GPU rendering, CLAUDE.md §8).
 *
 * Not interleaved: deck.gl draws on its own canvas on top of the map. Interleaving shares the
 * map's WebGL context, and React StrictMode's mount → unmount → mount attaches a second deck
 * device to that context ("WebGL context already attached"). The trade-off is that basemap
 * labels are not drawn above the data layers.
 */
export function DeckOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(
    () => new MapboxOverlay({ ...props, interleaved: false }),
  );
  overlay.setProps({ ...props, interleaved: false });
  return null;
}
