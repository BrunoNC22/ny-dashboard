import { type Palette, PALETTES, type Theme } from "@ny-dashboard/shared";
import { BarChart3, Moon, Plus, Settings2, Sparkles, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { ChartsDemo } from "../charts/ChartsDemo";
import {
  Badge,
  Button,
  Card,
  IconButton,
  Input,
  Modal,
  SegmentedControl,
  Select,
  Skeleton,
  Spinner,
  Tabs,
  toast,
  Tooltip,
} from "../components/ui";
import { MapDemo } from "../map/MapDemo";
import { PALETTE_ORDERS, SEQUENTIAL, STATUS } from "../styles/tokens";

const PALETTE_LABELS: Record<Palette, string> = {
  aurora: "Aurora",
  sunset: "Sunset",
  ocean: "Ocean",
  neon: "Neon",
  forest: "Forest",
  mono: "Mono",
};

/** Dev-only showcase of the design system (route /_ds). */
export function DesignSystemPage() {
  // ?theme=light&palette=sunset preselects a combination (handy for screenshots).
  const params = new URLSearchParams(window.location.search);
  const [theme, setTheme] = useState<Theme>(
    () =>
      (params.get("theme") as Theme | null) ??
      (document.documentElement.dataset.theme as Theme | undefined) ??
      "dark",
  );
  const [palette, setPalette] = useState<Palette>(
    () =>
      (params.get("palette") as Palette | null) ??
      (document.documentElement.dataset.palette as Palette | undefined) ??
      "aurora",
  );
  const [modal, setModal] = useState(false);
  const [tab, setTab] = useState<"a" | "b">("a");
  const [granularity, setGranularity] = useState<"day" | "week" | "month">(
    "day",
  );
  const [service, setService] = useState("all");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.palette = palette;
  }, [theme, palette]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-accent-gradient text-3xl font-semibold tracking-tight">
          Design system
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="Tema"
            value={theme}
            onChange={setTheme}
            iconOnly
            options={[
              { value: "dark", label: "Escuro", icon: <Moon size={14} /> },
              { value: "light", label: "Claro", icon: <Sun size={14} /> },
            ]}
          />
          <Select
            label="Paleta"
            hideLabel
            value={palette}
            onChange={setPalette}
            options={PALETTES.map((value) => ({
              value,
              label: PALETTE_LABELS[value],
            }))}
          />
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Card title="Paleta de séries" icon={<BarChart3 size={14} />}>
          <ol className="grid grid-cols-4 gap-2">
            {PALETTE_ORDERS[palette].map((hue, i) => (
              <li
                key={hue}
                className="flex items-center gap-2 text-xs text-ink-2"
              >
                <span
                  className="size-6 rounded-md ring-2 ring-surface"
                  style={{ background: `var(--nyd-series-${String(i + 1)})` }}
                />
                {i + 1}. {hue}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full">
            {SEQUENTIAL.map((color) => (
              <span
                key={color}
                className="flex-1"
                style={{ background: color }}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            Escala sequencial (magnitude)
          </p>
        </Card>

        <Card title="Status" icon={<Sparkles size={14} />} highlight>
          <div className="flex flex-wrap gap-2">
            <Badge tone="good">Bom</Badge>
            <Badge tone="warning">Atenção</Badge>
            <Badge tone="bad">Ruim</Badge>
            <Badge tone="neutral">Neutro</Badge>
            <Badge tone="accent">Destaque</Badge>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px] text-ink-2">
            {Object.entries(STATUS).map(([name, color]) => (
              <div key={name}>
                <div
                  className="mb-1 h-6 rounded-md"
                  style={{ background: color }}
                />
                {name}
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Botões"
          actions={
            <IconButton
              label="Configurar"
              icon={<Settings2 size={16} />}
              size="sm"
            />
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={<Plus size={16} />}>
              Adicionar widget
            </Button>
            <Button>Secundário</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Remover</Button>
            <Button variant="primary" loading>
              Salvando
            </Button>
            <Tooltip content="Dica com contexto">
              <Button size="sm">Com tooltip</Button>
            </Tooltip>
          </div>
        </Card>

        <Card title="Campos">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Usuário" placeholder="demo" />
            <Input
              label="Senha"
              type="password"
              error="A senha precisa ter pelo menos 8 caracteres"
            />
            <Select
              label="Serviço"
              value={service}
              onChange={setService}
              options={[
                { value: "all", label: "Todos" },
                { value: "yellow", label: "Yellow Taxi" },
                { value: "fhvhv", label: "Apps (Uber/Lyft)" },
              ]}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-2">
                Granularidade
              </span>
              <SegmentedControl
                label="Granularidade"
                size="sm"
                value={granularity}
                onChange={setGranularity}
                options={[
                  { value: "day", label: "Dia" },
                  { value: "week", label: "Semana" },
                  { value: "month", label: "Mês" },
                ]}
              />
            </div>
          </div>
        </Card>

        <Card title="Abas, modal e toasts">
          <Tabs
            label="Exemplo"
            value={tab}
            onChange={setTab}
            tabs={[
              {
                value: "a",
                label: "Dados",
                content: <p className="text-sm text-ink-2">Conteúdo A</p>,
              },
              {
                value: "b",
                label: "Aparência",
                content: <p className="text-sm text-ink-2">Conteúdo B</p>,
              },
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setModal(true);
              }}
            >
              Abrir modal
            </Button>
            <Button onClick={() => toast.success("Dashboard salvo")}>
              Toast sucesso
            </Button>
            <Button onClick={() => toast.error("Falha ao salvar")}>
              Toast erro
            </Button>
          </div>
        </Card>

        <Card title="Carregando">
          <div className="flex items-center gap-4">
            <Spinner size={24} className="text-accent" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-24" />
            </div>
          </div>
        </Card>
      </section>

      <ChartsDemo />
      <MapDemo />

      <Modal
        open={modal}
        onClose={() => {
          setModal(false);
        }}
        title="Editar widget"
        description="Exemplo de modal com foco preso e Escape."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setModal(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setModal(false);
              }}
            >
              Salvar
            </Button>
          </>
        }
      >
        <Input label="Título" defaultValue="Corridas por dia" />
      </Modal>
    </main>
  );
}
