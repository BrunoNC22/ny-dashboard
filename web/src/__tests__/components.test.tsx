import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

// Canvas charts cannot render in jsdom: the design system page test only checks the controls.
vi.mock("react-chartjs-2", () => ({
  Bar: () => null,
  Doughnut: () => null,
  Line: () => null,
  Radar: () => null,
  Scatter: () => null,
}));

import {
  Badge,
  Button,
  Card,
  IconButton,
  Input,
  Modal,
  SegmentedControl,
  Select,
  Tabs,
  toast,
  Toaster,
  Tooltip,
  useToastStore,
} from "../components/ui";
import { DesignSystemPage } from "../pages/DesignSystemPage";

describe("Button / IconButton", () => {
  it("clicks, and is disabled + busy while loading", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Salvar</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onClick).toHaveBeenCalledOnce();

    rerender(
      <Button onClick={onClick} loading>
        Salvar
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Salvar/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("status", { name: "Carregando" }),
    ).toBeInTheDocument();
  });

  it("gives icon buttons an accessible name", () => {
    render(<IconButton label="Remover widget" icon={<span>x</span>} />);
    expect(
      screen.getByRole("button", { name: "Remover widget" }),
    ).toBeInTheDocument();
  });
});

describe("Card", () => {
  it("renders the header only when it has content", () => {
    const { rerender } = render(<Card title="Corridas">conteúdo</Card>);
    expect(
      screen.getByRole("heading", { name: "Corridas" }),
    ).toBeInTheDocument();
    rerender(<Card>conteúdo</Card>);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

describe("Modal", () => {
  function Harness({ onClose }: { onClose: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
        >
          abrir
        </button>
        <Modal
          open={open}
          title="Editar widget"
          description="descrição"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          <input aria-label="Título" />
        </Modal>
      </>
    );
  }

  it("opens as a labelled dialog, moves focus inside and closes with Escape", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "abrir" }));
    const dialog = screen.getByRole("dialog", { name: "Editar widget" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("descrição");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "abrir" })).toHaveFocus(); // focus restored
  });

  it("closes on backdrop click and with the close button", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "abrir" }));
    await userEvent.click(screen.getByTestId("modal-backdrop"));
    await userEvent.click(screen.getByRole("button", { name: "abrir" }));
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("form fields", () => {
  it("links errors to the input", () => {
    render(<Input label="Senha" error="Muito curta" />);
    const input = screen.getByLabelText("Senha");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Muito curta");
    expect(screen.getByRole("alert")).toHaveTextContent("Muito curta");
  });

  it("select reports the typed value", async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Serviço"
        value="yellow"
        onChange={onChange}
        options={[
          { value: "yellow", label: "Yellow" },
          { value: "green", label: "Green" },
        ]}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("Serviço"), "green");
    expect(onChange).toHaveBeenCalledWith("green");
  });
});

describe("SegmentedControl and Tabs", () => {
  it("segmented control is a radio group navigable with arrows", async () => {
    function Harness() {
      const [value, setValue] = useState<"day" | "week">("day");
      return (
        <SegmentedControl
          label="Granularidade"
          value={value}
          onChange={setValue}
          options={[
            { value: "day", label: "Dia" },
            { value: "week", label: "Semana" },
          ]}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByRole("radio", { name: "Dia" })).toBeChecked();
    screen.getByRole("radio", { name: "Dia" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Semana" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Semana" })).toHaveFocus();
  });

  it("tabs switch panels with click and arrows", async () => {
    function Harness() {
      const [value, setValue] = useState<"a" | "b">("a");
      return (
        <Tabs
          label="Editor"
          value={value}
          onChange={setValue}
          tabs={[
            { value: "a", label: "Dados", content: "painel A" },
            { value: "b", label: "Aparência", content: "painel B" },
          ]}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("painel A");
    await userEvent.click(screen.getByRole("tab", { name: "Aparência" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("painel B");
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Dados" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

describe("Badge, Tooltip and Toast", () => {
  it("status badges carry an icon and a text label", () => {
    const { container } = render(<Badge tone="bad">Ruim</Badge>);
    expect(screen.getByText("Ruim")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("tooltip appears on keyboard focus", async () => {
    render(
      <Tooltip content="Dica">
        <button type="button">alvo</button>
      </Tooltip>,
    );
    await userEvent.tab();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Dica");
  });

  it("toasts are announced and auto-dismissed", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast.success("Dashboard salvo");
      toast.error("Falha ao salvar");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Dashboard salvo");
    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao salvar");
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText("Dashboard salvo")).not.toBeInTheDocument();
    expect(screen.getByText("Falha ao salvar")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(useToastStore.getState().toasts).toEqual([]);
    vi.useRealTimers();
  });
});

describe("design system page", () => {
  it("switches the theme and palette on <html>", async () => {
    render(<DesignSystemPage />);
    expect(document.documentElement.dataset.theme).toBe("dark");
    await userEvent.click(screen.getByRole("radio", { name: "Claro" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await userEvent.selectOptions(screen.getByLabelText("Paleta"), "sunset");
    expect(document.documentElement.dataset.palette).toBe("sunset");
  });
});
