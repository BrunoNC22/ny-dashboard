import { expect, test } from "@playwright/test";

import {
  drag,
  expectInViewport,
  layoutItem,
  newUsername,
  openDashboard,
  PASSWORD,
  register,
  savedDashboard,
  scrollToTop,
  stableBox,
  widget,
} from "./helpers";

test("demo signs in and sees the default dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill("demo");
  await page.getByLabel("Senha").fill("demo1234");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("banner").getByText("demo")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Corridas", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Corridas por zona de embarque" }),
  ).toBeVisible();
});

test("adds, edits, duplicates and removes widgets, saved to the account", async ({
  page,
}) => {
  await register(page.request);
  await openDashboard(page);

  // add from the gallery
  await page.getByRole("button", { name: "Adicionar widget" }).click();
  const gallery = page.getByRole("dialog", { name: "Adicionar widget" });
  await gallery.getByLabel("Buscar modelos").fill("rotas");
  await gallery
    .getByRole("button", { name: /Rotas mais frequentes.*Tabela/ })
    .click();
  await expect(
    page.getByRole("region", { name: "Rotas mais frequentes" }).first(),
  ).toBeVisible();
  await expect
    .poll(async () =>
      (await savedDashboard(page.request)).widgets.some(
        (w) => w.type === "table" && w.dimension === "route",
      ),
    )
    .toBe(true);

  // edit (title) in the modal
  const trips = page.getByRole("region", { name: "Corridas", exact: true });
  await trips.hover();
  await page
    .getByRole("button", { name: "Editar Corridas", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: /Editar/ });
  await editor.getByLabel("Título").fill("Total de corridas");
  await editor.getByRole("button", { name: "Salvar" }).click();
  await expect(
    page.getByRole("region", { name: "Total de corridas" }),
  ).toBeVisible();

  // duplicate and remove
  const revenue = page.getByRole("region", { name: "Receita", exact: true });
  await revenue.hover();
  await page
    .getByRole("button", { name: "Duplicar Receita", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Receita", exact: true }),
  ).toHaveCount(2);
  const fare = page.getByRole("region", { name: "Tarifa média" });
  await fare.hover();
  await page
    .getByRole("button", { name: "Remover Tarifa média", exact: true })
    .click();
  await expect(fare).toHaveCount(0);

  await expect
    .poll(async () => {
      const { widgets } = await savedDashboard(page.request);
      return {
        renamed: widgets.find((w) => w.id === "kpi-trips")?.title,
        revenue: widgets.filter((w) => w.title === "Receita").length,
        fare: widgets.some((w) => w.id === "kpi-avg-fare"),
      };
    })
    .toEqual({ renamed: "Total de corridas", revenue: 2, fare: false });
});

test("moving and resizing on desktop does not touch the mobile layout, and vice versa", async ({
  page,
  browser,
}) => {
  // Three drags over a page full of charts and maps: slow with software rendering (CI).
  test.slow();
  await register(page.request);
  await openDashboard(page);
  const initial = await savedDashboard(page.request);

  // desktop: drag a KPI by its header two columns to the right, grow the map by its corner
  const handle = widget(page, "kpi-trips").locator(".widget-drag-handle");
  const box = await stableBox(handle);
  await drag(
    page,
    { x: box.x + 30, y: box.y + box.height / 2 },
    { x: box.x + 30 + 2 * 115, y: box.y + box.height / 2 },
  );
  const map = widget(page, "map-zones");
  await scrollToTop(map);
  await map.hover();
  const corner = await stableBox(map.locator(".react-resizable-handle"));
  expectInViewport(page, corner);
  await drag(
    page,
    { x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 },
    { x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 + 120 },
  );

  await expect
    .poll(async () => {
      const { layouts } = await savedDashboard(page.request);
      return {
        movedRight:
          layoutItem(layouts.desktop, "kpi-trips").x >
          layoutItem(initial.layouts.desktop, "kpi-trips").x,
        taller:
          layoutItem(layouts.desktop, "map-zones").h >
          layoutItem(initial.layouts.desktop, "map-zones").h,
        mobileUntouched:
          JSON.stringify(layouts.mobile) ===
          JSON.stringify(initial.layouts.mobile),
      };
    })
    .toEqual({ movedRight: true, taller: true, mobileUntouched: true });
  const afterDesktop = await savedDashboard(page.request);

  // mobile: a phone (another context, same session) grows a chart; desktop must not change
  // Tall phone viewport: the chart and the room to drag fit without scrolling (scrolling
  // while widgets below keep loading made the handle move under the pointer).
  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 1600 },
    storageState: await page.context().storageState(),
  });
  const phone = await phoneContext.newPage();
  await openDashboard(phone);
  const chart = widget(phone, "line-trips-projection");
  await expect(chart.locator("canvas")).toBeVisible();
  const mobileCorner = await stableBox(
    chart.locator(".react-resizable-handle"),
  );
  expectInViewport(phone, mobileCorner);
  await drag(
    phone,
    {
      x: mobileCorner.x + mobileCorner.width / 2,
      y: mobileCorner.y + mobileCorner.height / 2,
    },
    {
      x: mobileCorner.x + mobileCorner.width / 2,
      y: mobileCorner.y + mobileCorner.height / 2 + 120,
    },
  );
  await expect
    .poll(async () => {
      const { layouts } = await savedDashboard(page.request);
      return {
        taller:
          layoutItem(layouts.mobile, "line-trips-projection").h >
          layoutItem(afterDesktop.layouts.mobile, "line-trips-projection").h,
        desktopUntouched:
          JSON.stringify(layouts.desktop) ===
          JSON.stringify(afterDesktop.layouts.desktop),
      };
    })
    .toEqual({ taller: true, desktopUntouched: true });
  await phoneContext.close();
});

test("another device sees the same dashboard, theme and palette", async ({
  page,
  browser,
}) => {
  const username = await register(page.request);
  await openDashboard(page);

  const radar = page.getByRole("region", { name: "Corridas por hora do dia" });
  await radar.hover();
  await page
    .getByRole("button", {
      name: "Remover Corridas por hora do dia",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Usar tema claro" }).click();
  await page.getByRole("button", { name: "Paleta de cores" }).click();
  await page
    .getByRole("dialog", { name: "Paleta de cores" })
    .getByRole("button", { name: "Ocean" })
    .click();
  await expect
    .poll(async () => {
      const preferences = await page.request.get("/api/preferences");
      const { widgets } = await savedDashboard(page.request);
      return {
        preferences: ((await preferences.json()) as { preferences: unknown })
          .preferences,
        radar: widgets.some((w) => w.id === "radar-hour-of-day"),
      };
    })
    .toEqual({
      preferences: { theme: "light", palette: "ocean" },
      radar: false,
    });

  // "another device": a fresh browser context signs in through the UI
  const other = await browser.newContext();
  const device = await other.newPage();
  await device.goto("/login");
  await device.getByLabel("Usuário").fill(username);
  await device.getByLabel("Senha").fill(PASSWORD);
  await device.getByRole("button", { name: "Entrar" }).click();
  await expect(
    device.getByRole("region", { name: "Corridas", exact: true }),
  ).toBeVisible();
  await expect(
    device.getByRole("region", { name: "Corridas por hora do dia" }),
  ).toHaveCount(0);
  await expect(device.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(device.locator("html")).toHaveAttribute("data-palette", "ocean");
  await other.close();
});

test("a visitor customizes, creates an account and imports the local dashboard", async ({
  page,
}) => {
  await openDashboard(page);
  const map = page.getByRole("region", { name: "Rotas mais frequentes" });
  await map.hover();
  await page
    .getByRole("button", { name: "Remover Rotas mais frequentes", exact: true })
    .click();
  await expect(page.getByText("Salvo neste navegador")).toBeVisible();

  await page.goto("/cadastro");
  await page.getByLabel("Usuário").fill(newUsername());
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirmar senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();

  await page
    .getByRole("dialog", { name: "Importar o dashboard deste navegador?" })
    .getByRole("button", { name: "Importar" })
    .click();
  await expect(page).toHaveURL("/");
  await expect
    .poll(async () =>
      (await savedDashboard(page.request)).widgets.some(
        (w) => w.id === "map-routes",
      ),
    )
    .toBe(false);
  await expect(
    page.getByRole("region", { name: "Rotas mais frequentes" }),
  ).toHaveCount(0);
});
