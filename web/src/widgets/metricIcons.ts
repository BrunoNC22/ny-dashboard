import { type MetricId, METRICS } from "@ny-dashboard/shared";
import {
  BadgeDollarSign,
  Banknote,
  CarTaxiFront,
  CreditCard,
  Gauge,
  HandCoins,
  Hourglass,
  type LucideIcon,
  Percent,
  Plane,
  Receipt,
  Route,
  Ruler,
  Timer,
  TrafficCone,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { createElement, type ReactElement } from "react";

/**
 * Lucide icons named by the metric catalog (kebab-case in `shared`). An explicit map keeps the
 * bundle small (the full lucide map would ship every icon); a test checks it covers the catalog.
 */
export const METRIC_ICONS: Readonly<Record<string, LucideIcon>> = {
  "badge-dollar-sign": BadgeDollarSign,
  banknote: Banknote,
  "car-taxi-front": CarTaxiFront,
  "credit-card": CreditCard,
  gauge: Gauge,
  "hand-coins": HandCoins,
  hourglass: Hourglass,
  percent: Percent,
  plane: Plane,
  receipt: Receipt,
  route: Route,
  ruler: Ruler,
  timer: Timer,
  "traffic-cone": TrafficCone,
  users: Users,
  "users-round": UsersRound,
  wallet: Wallet,
};

export const metricIcon = (metric: MetricId, size = 16): ReactElement =>
  createElement(METRIC_ICONS[METRICS[metric].icon] ?? Gauge, {
    size,
    "aria-hidden": true,
  });
