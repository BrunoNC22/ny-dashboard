import { describe, expect, it } from "vitest";

import { dashboardStateSchema } from "../index";
import { validDashboard } from "./fixtures";

const issues = (value: unknown): string[] => {
  const result = dashboardStateSchema.safeParse(value);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.message);
};

describe("dashboardStateSchema", () => {
  it("accepts a consistent dashboard", () => {
    expect(issues(validDashboard())).toEqual([]);
  });

  it("accepts an empty dashboard", () => {
    expect(
      issues({
        ...validDashboard(),
        widgets: [],
        layouts: { desktop: [], mobile: [] },
      }),
    ).toEqual([]);
  });

  it("rejects duplicated widget ids", () => {
    const state = validDashboard();
    const first = state.widgets[0];
    if (!first) throw new Error("fixture must have widgets");
    state.widgets.push(first);
    expect(issues(state)).toContain('Duplicate widget id "kpi-trips"');
  });

  it("requires every widget in both layouts", () => {
    const state = validDashboard();
    state.layouts.mobile.pop();
    expect(issues(state)).toContain(
      'Widget "line-revenue" is missing from the mobile layout',
    );
  });

  it("rejects layout items for unknown widgets and duplicates", () => {
    const state = validDashboard();
    state.layouts.desktop.push({ i: "ghost", x: 0, y: 9, w: 1, h: 1 });
    state.layouts.desktop.push({ i: "kpi-trips", x: 0, y: 12, w: 1, h: 1 });
    const messages = issues(state);
    expect(messages).toContain('Unknown widget "ghost"');
    expect(messages).toContain('Duplicate layout item "kpi-trips"');
  });

  it("checks the column count of each breakpoint independently", () => {
    const desktopOverflow = validDashboard();
    desktopOverflow.layouts.desktop[1] = {
      i: "line-revenue",
      x: 4,
      y: 0,
      w: 9,
      h: 4,
    };
    expect(issues(desktopOverflow)).toContain(
      'Item "line-revenue" exceeds the 12 desktop columns',
    );

    const mobileOverflow = validDashboard();
    mobileOverflow.layouts.mobile[0] = {
      i: "kpi-trips",
      x: 1,
      y: 0,
      w: 2,
      h: 2,
    };
    expect(issues(mobileOverflow)).toContain(
      'Item "kpi-trips" exceeds the 2 mobile columns',
    );
  });

  it("rejects unsupported versions", () => {
    expect(
      dashboardStateSchema.safeParse({ ...validDashboard(), version: 2 })
        .success,
    ).toBe(false);
  });
});
