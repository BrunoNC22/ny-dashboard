import type { Breakpoint, WidgetType } from "@ny-dashboard/shared";
import {
  ChartArea,
  ChartBar,
  ChartColumn,
  ChartColumnStacked,
  ChartLine,
  ChartPie,
  ChartRadar,
  ChartScatter,
  Donut,
  Gauge,
  Map,
  Radar,
  Table,
} from "lucide-react";
import {
  type ComponentType,
  createElement,
  lazy,
  type ReactElement,
} from "react";

import { PlaceholderWidget } from "./PlaceholderWidget";
import type { GridSize, WidgetDefinition, WidgetProps } from "./types";

type Sizes = Readonly<Record<Breakpoint, GridSize>>;

const size = (
  desktop: [w: number, h: number, minW: number, minH: number],
  mobile: [w: number, h: number, minW: number, minH: number],
): Sizes => ({
  desktop: {
    w: desktop[0],
    h: desktop[1],
    minW: desktop[2],
    minH: desktop[3],
  },
  mobile: { w: mobile[0], h: mobile[1], minW: mobile[2], minH: mobile[3] },
});

const SERIES = size([6, 8, 3, 5], [2, 7, 2, 5]);
const CATEGORICAL = size([4, 8, 3, 5], [2, 7, 2, 5]);
const SAMPLE = size([6, 9, 4, 6], [2, 8, 2, 6]);

// Heavy widgets load on demand (CLAUDE.md §6.1: map with MapLibre + deck.gl, 1M-point sample).
const MapWidget = lazy(() => import("./map/MapWidget"));
const ScatterWidget = lazy(() =>
  import("./sample/TripSampleWidget").then((m) => ({
    default: m.ScatterWidget,
  })),
);
const BubbleWidget = lazy(() =>
  import("./sample/TripSampleWidget").then((m) => ({
    default: m.BubbleWidget,
  })),
);

/** Until each type gets its own component (#43–#49). */
const placeholder = <T extends WidgetType>() =>
  PlaceholderWidget as unknown as ComponentType<WidgetProps<T>>;

type Registry = { readonly [T in WidgetType]: WidgetDefinition<T> };

export const WIDGET_REGISTRY: Registry = {
  kpi: {
    type: "kpi",
    label: "KPI",
    icon: Gauge,
    group: "kpi",
    sizes: size([2, 3, 2, 3], [1, 3, 1, 3]),
    component: placeholder(),
  },
  line: {
    type: "line",
    label: "Linha",
    icon: ChartLine,
    group: "series",
    sizes: SERIES,
    component: placeholder(),
  },
  area: {
    type: "area",
    label: "Área",
    icon: ChartArea,
    group: "series",
    sizes: SERIES,
    component: placeholder(),
  },
  bar: {
    type: "bar",
    label: "Barras",
    icon: ChartColumn,
    group: "series",
    sizes: SERIES,
    component: placeholder(),
  },
  stacked_bar: {
    type: "stacked_bar",
    label: "Barras empilhadas",
    icon: ChartColumnStacked,
    group: "series",
    sizes: SERIES,
    component: placeholder(),
  },
  doughnut: {
    type: "doughnut",
    label: "Rosca",
    icon: Donut,
    group: "composition",
    sizes: CATEGORICAL,
    component: placeholder(),
  },
  pie: {
    type: "pie",
    label: "Pizza",
    icon: ChartPie,
    group: "composition",
    sizes: CATEGORICAL,
    component: placeholder(),
  },
  polar_area: {
    type: "polar_area",
    label: "Área polar",
    icon: Radar,
    group: "composition",
    sizes: CATEGORICAL,
    component: placeholder(),
  },
  bar_horizontal: {
    type: "bar_horizontal",
    label: "Ranking (barras horizontais)",
    icon: ChartBar,
    group: "composition",
    sizes: CATEGORICAL,
    component: placeholder(),
  },
  radar: {
    type: "radar",
    label: "Radar",
    icon: ChartRadar,
    group: "distribution",
    sizes: CATEGORICAL,
    component: placeholder(),
  },
  scatter: {
    type: "scatter",
    label: "Dispersão",
    icon: ChartScatter,
    group: "distribution",
    sizes: SAMPLE,
    component: ScatterWidget,
  },
  bubble: {
    type: "bubble",
    label: "Bolhas",
    icon: ChartScatter,
    group: "distribution",
    sizes: SAMPLE,
    component: BubbleWidget,
  },
  table: {
    type: "table",
    label: "Tabela",
    icon: Table,
    group: "table",
    sizes: size([6, 9, 4, 5], [2, 9, 2, 5]),
    component: placeholder(),
  },
  map: {
    type: "map",
    label: "Mapa",
    icon: Map,
    group: "map",
    sizes: size([6, 10, 4, 6], [2, 9, 2, 6]),
    component: MapWidget,
  },
};

export const widgetDefinition = <T extends WidgetType>(
  type: T,
): WidgetDefinition<T> => WIDGET_REGISTRY[type];

/** The type's icon as an element (keeps components static in render). */
export const widgetIcon = (type: WidgetType, size = 16): ReactElement =>
  createElement(WIDGET_REGISTRY[type].icon, { size, "aria-hidden": true });
