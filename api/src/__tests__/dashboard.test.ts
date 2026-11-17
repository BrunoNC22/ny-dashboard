import {
  apiErrorSchema,
  createDefaultDashboard,
  dashboardResponseSchema,
  preferencesResponseSchema,
} from "@ny-dashboard/shared";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createTestApp } from "./helpers";

const signUp = async (
  app: ReturnType<typeof createTestApp>["app"],
  username: string,
) => {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/register")
    .send({ username, password: "senha1234" });
  return agent;
};

describe("/api/dashboard", () => {
  it("requires a session", async () => {
    const { app } = createTestApp();
    for (const response of [
      await request(app).get("/api/dashboard"),
      await request(app)
        .put("/api/dashboard")
        .send({ state: createDefaultDashboard() }),
      await request(app).get("/api/preferences"),
    ]) {
      expect(response.status).toBe(401);
    }
  });

  it("starts with the default dashboard and saves the whole state", async () => {
    const { app } = createTestApp();
    const agent = await signUp(app, "ana");

    const initial = dashboardResponseSchema.parse(
      (await agent.get("/api/dashboard")).body,
    );
    expect(initial.state).toEqual(createDefaultDashboard());

    const state = createDefaultDashboard();
    state.widgets = state.widgets.filter((widget) => widget.type !== "scatter");
    state.layouts.desktop = state.layouts.desktop.filter(
      (item) => item.i !== "scatter-jfk",
    );
    state.layouts.mobile = state.layouts.mobile.filter(
      (item) => item.i !== "scatter-jfk",
    );
    state.layouts.desktop[0] = { i: "kpi-trips", x: 0, y: 0, w: 4, h: 3 }; // desktop only

    const saved = await agent.put("/api/dashboard").send({ state });
    expect(saved.status).toBe(200);
    const body = dashboardResponseSchema.parse(saved.body);
    expect(Date.parse(body.updatedAt)).toBeGreaterThan(
      Date.parse(initial.updatedAt),
    );

    const reloaded = dashboardResponseSchema.parse(
      (await agent.get("/api/dashboard")).body,
    );
    expect(reloaded.state).toEqual(state);
    expect(reloaded.state.layouts.mobile[0]).toEqual({
      i: "kpi-trips",
      x: 0,
      y: 0,
      w: 1,
      h: 3,
    });
  });

  it("rejects inconsistent states with 400", async () => {
    const { app } = createTestApp();
    const agent = await signUp(app, "bia");
    const state = createDefaultDashboard();
    state.layouts.mobile.pop(); // widget missing from the mobile layout
    const response = await agent.put("/api/dashboard").send({ state });
    expect(response.status).toBe(400);
    expect(apiErrorSchema.parse(response.body).error.code).toBe(
      "VALIDATION_ERROR",
    );
  });

  it("isolates users from each other", async () => {
    const { app } = createTestApp();
    const ana = await signUp(app, "ana");
    const bia = await signUp(app, "bia");
    const state = createDefaultDashboard();
    state.filters.services = ["green"];
    await ana.put("/api/dashboard").send({ state });

    const biaState = dashboardResponseSchema.parse(
      (await bia.get("/api/dashboard")).body,
    ).state;
    expect(biaState.filters.services).toEqual([]);
    const anaState = dashboardResponseSchema.parse(
      (await ana.get("/api/dashboard")).body,
    ).state;
    expect(anaState.filters.services).toEqual(["green"]);
  });

  it("serves the default dashboard when the stored state became invalid", async () => {
    const onInvalidDashboard = vi.fn();
    const { app, data } = createTestApp({ onInvalidDashboard });
    const agent = await signUp(app, "carla");
    const userId = data.users[0]?.id ?? "";
    data.dashboards.set(userId, {
      state: { version: 0 },
      updatedAt: new Date(),
    });

    const response = await agent.get("/api/dashboard");
    expect(response.status).toBe(200);
    expect(dashboardResponseSchema.parse(response.body).state).toEqual(
      createDefaultDashboard(),
    );
    expect(onInvalidDashboard).toHaveBeenCalledWith(userId);
  });
});

describe("/api/preferences", () => {
  it("returns the defaults and saves theme and palette", async () => {
    const { app } = createTestApp();
    const agent = await signUp(app, "dani");

    const initial = preferencesResponseSchema.parse(
      (await agent.get("/api/preferences")).body,
    );
    expect(initial.preferences).toEqual({ theme: "dark", palette: "aurora" });

    const saved = await agent
      .put("/api/preferences")
      .send({ theme: "light", palette: "ocean" });
    expect(saved.status).toBe(200);
    expect(preferencesResponseSchema.parse(saved.body).preferences).toEqual({
      theme: "light",
      palette: "ocean",
    });
    const reloaded = preferencesResponseSchema.parse(
      (await agent.get("/api/preferences")).body,
    );
    expect(reloaded.preferences.palette).toBe("ocean");
  });

  it("rejects unknown palettes", async () => {
    const { app } = createTestApp();
    const agent = await signUp(app, "eva");
    const response = await agent
      .put("/api/preferences")
      .send({ theme: "dark", palette: "rainbow" });
    expect(response.status).toBe(400);
  });
});
