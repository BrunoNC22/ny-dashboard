import { APP_NAME } from "@ny-dashboard/shared";
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

describe("web test environment", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("runs the entry point against jsdom", async () => {
    await import("../main");
    expect(document.title).toBe(APP_NAME);
  });

  it("supports Testing Library queries and jest-dom matchers", () => {
    document.body.innerHTML = '<button type="button">Adicionar widget</button>';
    const button = screen.getByRole("button", { name: "Adicionar widget" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Adicionar");
  });
});
