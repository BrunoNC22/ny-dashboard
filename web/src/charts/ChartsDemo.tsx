import { Bar, Doughnut, Line, Radar, Scatter } from "react-chartjs-2";

import { Card } from "../components/ui";
import {
  areaFill,
  cartesianOptions,
  comparisonStyle,
  crosshairPlugin,
  pointStyle,
  projectionStyle,
  seriesColor,
  stackedBarStyle,
} from "./chartTheme";
import { useChartTheme } from "./useChartTheme";

const days = Array.from(
  { length: 30 },
  (_, i) => `${String(i + 1).padStart(2, "0")}/09`,
);
const wave = (base: number, amp: number, phase = 0) =>
  days.map((_, i) =>
    Math.round(
      base + amp * Math.sin((i + phase) / 3.2) + (i % 7 === 5 ? amp * 0.6 : 0),
    ),
  );

/** Dev-only showcase of every chart style from chartTheme.ts (rendered on /_ds). */
export function ChartsDemo() {
  const theme = useChartTheme();
  const c = (i: number) => seriesColor(theme, i);

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Card title="Linha: atual × anterior × projeção" className="h-72">
        <Line
          plugins={[crosshairPlugin(theme)]}
          options={cartesianOptions<"line">()}
          data={{
            labels: days,
            datasets: [
              {
                label: "Set/2026",
                data: wave(820, 90),
                borderColor: c(0),
                backgroundColor: areaFill(c(0)),
                fill: true,
                pointStyle: pointStyle(0),
              },
              {
                label: "Ago/2026",
                data: wave(760, 80, 2),
                ...comparisonStyle(c(0)),
              },
              {
                label: "Projeção",
                data: wave(790, 60, 1),
                ...projectionStyle(theme),
              },
            ],
          }}
        />
      </Card>
      <Card title="Barras empilhadas por serviço" className="h-72">
        <Bar
          options={{
            ...cartesianOptions<"bar">(),
            scales: {
              x: { stacked: true },
              y: { stacked: true, beginAtZero: true },
            },
          }}
          data={{
            labels: days.slice(0, 12),
            datasets: ["Apps", "Yellow", "Green"].map((label, i) => ({
              label,
              data: wave(400 / (i + 1), 40, i).slice(0, 12),
              ...stackedBarStyle(theme, c(i)),
            })),
          }}
        />
      </Card>
      <Card title="Participação por empresa" className="h-72">
        <Doughnut
          options={{
            cutout: "68%",
            plugins: { legend: { position: "right" } },
          }}
          data={{
            labels: ["Uber", "Lyft", "Yellow", "Green"],
            datasets: [
              {
                data: [62, 23, 14, 1],
                backgroundColor: [c(0), c(1), c(2), c(3)],
              },
            ],
          }}
        />
      </Card>
      <Card title="Corridas por hora do dia" className="h-72">
        <Radar
          options={{
            scales: { r: { beginAtZero: true, ticks: { display: false } } },
          }}
          data={{
            labels: Array.from({ length: 24 }, (_, h) => `${String(h)}h`),
            datasets: [
              {
                label: "Set/2026",
                data: Array.from(
                  { length: 24 },
                  (_, h) => 40 + 35 * Math.sin((h - 6) / 3.8) ** 2,
                ),
                borderColor: c(0),
                backgroundColor: areaFill(c(0)),
                fill: true,
              },
              {
                label: "Ago/2026",
                data: Array.from(
                  { length: 24 },
                  (_, h) => 36 + 30 * Math.sin((h - 6) / 3.8) ** 2,
                ),
                ...comparisonStyle(c(1)),
              },
            ],
          }}
        />
      </Card>
      <Card
        title="Scatter: 4 categorias com cor + forma"
        className="h-72 md:col-span-2"
      >
        <Scatter
          options={{
            scales: { x: { title: { display: true, text: "Distância (mi)" } } },
          }}
          data={{
            datasets: ["Uber", "Lyft", "Yellow", "Green"].map((label, i) => ({
              label,
              pointStyle: pointStyle(i),
              pointRadius: 4,
              backgroundColor: c(i),
              borderColor: theme.surface,
              borderWidth: 1,
              data: Array.from({ length: 60 }, (_, k) => {
                const x = ((k * 37 + i * 11) % 100) / 6;
                return { x, y: 5 + x * (2.6 + i * 0.3) + ((k * 13) % 9) };
              }),
            })),
          }}
        />
      </Card>
    </section>
  );
}
