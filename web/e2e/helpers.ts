import type { DashboardResponse, GridItem } from "@ny-dashboard/shared";
import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";

export const PASSWORD = "senha1234";

/** Unique username (3–32 chars of [a-z0-9._-]) so tests never share a dashboard. */
export const newUsername = (): string =>
  `e2e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Creates an account through the API; the browser context keeps the session cookie. */
export const register = async (
  request: APIRequestContext,
  username = newUsername(),
): Promise<string> => {
  const response = await request.post("/api/auth/register", {
    data: { username, password: PASSWORD },
  });
  expect(response.status()).toBe(201);
  return username;
};

export const savedDashboard = async (
  request: APIRequestContext,
): Promise<DashboardResponse["state"]> => {
  const response = await request.get("/api/dashboard");
  expect(response.ok()).toBe(true);
  return ((await response.json()) as DashboardResponse).state;
};

export const layoutItem = (
  items: readonly GridItem[],
  id: string,
): GridItem => {
  const item = items.find((i) => i.i === id);
  if (!item) throw new Error(`no layout item ${id}`);
  return item;
};

export const widget = (page: Page, id: string) =>
  page.locator(`[data-widget-id="${id}"]`);

/** Opens the dashboard and waits for the grid. */
export const openDashboard = async (page: Page): Promise<void> => {
  await page.goto("/");
  await expect(widget(page, "kpi-trips")).toBeVisible();
};

/** Drags with real mouse events (react-grid-layout listens to them), in small steps. */
export const drag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 5, from.y + 5, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
};

/** Scrolls an element to the top of the viewport (room below it to drag a resize handle). */
export const scrollToTop = async (locator: Locator): Promise<void> => {
  // Every widget loaded first: later layout shifts would move the target after scrolling.
  await locator.page().waitForLoadState("networkidle");
  await locator.evaluate((element) => {
    element.scrollIntoView({ block: "start" });
  });
};

/** Fails early (clear message) if a drag would start outside the visible area. */
export const expectInViewport = (
  page: Page,
  box: { y: number; height: number },
  room = 150,
): void => {
  const height = page.viewportSize()?.height ?? 0;
  expect(
    box.y + box.height + room,
    "resize handle must leave room below it",
  ).toBeLessThan(height);
};

/**
 * Bounding box once the layout settles (charts load and the grid re-flows after navigation):
 * two equal reads in a row.
 */
export const stableBox = async (locator: Locator) => {
  let previous = "";
  for (let attempt = 0; attempt < 20; attempt++) {
    const box = await locator.boundingBox();
    const current = JSON.stringify(box);
    if (box && current === previous) return box;
    previous = current;
    await locator.page().waitForTimeout(250);
  }
  throw new Error("layout did not settle");
};
