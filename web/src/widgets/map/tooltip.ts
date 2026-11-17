import {
  formatDeltaPct,
  formatMetric,
  type MetricDirection,
  type MetricId,
} from "@ny-dashboard/shared";

import type { ZoneFeature } from "../../api/client";
import type { ZoneValue } from "./transform";

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);

export interface ZoneTooltipOptions {
  metric: MetricId;
  comparing: boolean;
  direction: MetricDirection;
}

/** deck.gl tooltip of a zone: name, borough, value and change (text, never color alone). */
export const zoneTooltip = (
  feature: ZoneFeature,
  values: ReadonlyMap<number, ZoneValue>,
  { metric, comparing, direction }: ZoneTooltipOptions,
) => {
  const value = values.get(feature.properties.locationId);
  const delta = value?.deltaPct ?? null;
  const better =
    delta === null
      ? null
      : direction === "higher_is_better"
        ? delta > 0
        : delta < 0;
  const deltaLine =
    comparing && delta !== null
      ? `<div class="nyd-tip-delta ${better ? "is-better" : "is-worse"}">${formatDeltaPct(delta)} ${
          better ? "melhorou" : "piorou"
        }</div>`
      : "";
  return {
    className: "nyd-map-tooltip",
    html: `<div class="nyd-tip-title">${escape(feature.properties.zone)}</div>
<div class="nyd-tip-sub">${escape(feature.properties.borough)}</div>
<div class="nyd-tip-value">${formatMetric(metric, value?.value ?? null)}</div>${deltaLine}`,
  };
};

/** Arc tooltip: "A → B" and the route value. */
export const flowTooltip = (
  flow: { fromName: string; toName: string; value: number },
  metric: MetricId,
) => ({
  className: "nyd-map-tooltip",
  html: `<div class="nyd-tip-title">${escape(flow.fromName)} → ${escape(flow.toName)}</div>
<div class="nyd-tip-value">${formatMetric(metric, flow.value)}</div>`,
});
