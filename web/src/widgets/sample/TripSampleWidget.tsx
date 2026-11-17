import { DATA_COVERAGE, formatValue } from "@ny-dashboard/shared";
import { Timer, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { Chart } from "react-chartjs-2";

import { useMeta, useTrips } from "../../api/hooks";
import { useChartTheme } from "../../charts/useChartTheme";
import { Badge, cn } from "../../components/ui";
import type { WidgetProps } from "../types";
import { WidgetBody } from "../WidgetBody";
import { WidgetNotices } from "../WidgetNotices";
import { renderTimer, sampleChartConfig } from "./sampleChart";
import {
  HEAVY_LIMIT,
  sampleNotice,
  type SampleWidget,
  toSampleDatasets,
  toTripsRequest,
} from "./transform";

function TripSampleChart({
  widget,
  filters,
}: WidgetProps<"scatter" | "bubble">) {
  const theme = useChartTheme();
  const sampleMonth = useMeta().data?.sampleMonth ?? DATA_COVERAGE.sampleMonth;
  const request = useMemo(
    () => toTripsRequest(widget as SampleWidget, filters),
    [widget, filters],
  );
  const query = useTrips(request);
  const [renderMs, setRenderMs] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (!query.data) return null;
    const datasets = toSampleDatasets(query.data, widget.colorBy);
    const config = sampleChartConfig(datasets, {
      type: widget.type,
      theme,
      x: widget.x,
      y: widget.y,
      ...(widget.type === "bubble" ? { r: widget.r } : {}),
    });
    return {
      ...config,
      plugins: [
        renderTimer<"scatter" | "bubble">((ms) => {
          setRenderMs(ms);
        }),
      ],
    };
  }, [query.data, widget, theme]);

  const notice = sampleNotice(filters, sampleMonth);
  if (query.isPending) return <WidgetBody status="loading" />;
  if (query.isError || !chart) {
    return (
      <WidgetBody
        status="error"
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (chart.total === 0) {
    return (
      <WidgetBody
        status="empty"
        message={notice ?? "Nenhuma corrida da amostra para estes filtros."}
      />
    );
  }

  const heavy = chart.total > HEAVY_LIMIT;
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-1.5 transition-opacity",
        query.isPlaceholderData && "opacity-60",
      )}
    >
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
        <span>
          <span className="font-semibold text-ink tabular-nums">
            {formatValue(chart.total, "count")}
          </span>{" "}
          corridas da amostra
        </span>
        <span className="inline-flex items-center gap-1 text-muted">
          <Timer size={12} aria-hidden />
          {renderMs === null
            ? "desenhando…"
            : `desenhado em ${formatValue(renderMs, "count")} ms`}
        </span>
        {heavy && (
          <Badge tone="warning" withIcon={false}>
            <Zap size={11} aria-hidden /> pesado
          </Badge>
        )}
      </p>
      <div className="relative min-h-0 flex-1" data-no-drag>
        <Chart
          key={`${String(chart.total)}-${widget.type}`}
          type={widget.type}
          data={chart.data}
          options={chart.options}
          plugins={chart.plugins}
          role="img"
          aria-label={`Gráfico: ${widget.title}`}
        />
      </div>
      <WidgetNotices
        notices={[
          ...(notice ? [notice] : []),
          ...(heavy
            ? [
                "Muitos pontos: o Chart.js fica lento de propósito (o mapa usa a GPU e aguenta este volume). Hover desligado.",
              ]
            : []),
          "Posição aproximada: a TLC não publica coordenadas.",
        ]}
      />
    </div>
  );
}

/** Scatter over the trip sample (#45), loaded on demand. */
export function ScatterWidget(props: WidgetProps<"scatter">) {
  return <TripSampleChart {...props} />;
}

/** Bubble chart over the trip sample (#45), loaded on demand. */
export function BubbleWidget(props: WidgetProps<"bubble">) {
  return <TripSampleChart {...props} />;
}
