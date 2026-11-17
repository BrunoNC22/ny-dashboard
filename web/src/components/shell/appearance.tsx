import { PALETTES } from "@ny-dashboard/shared";
import { Check, Moon, Palette as PaletteIcon, Sun } from "lucide-react";

import { usePreferencesStore } from "../../stores/preferencesStore";
import { seriesColors } from "../../styles/tokens";
import { cn, IconButton, Popover } from "../ui";
import { PALETTE_LABELS } from "./paletteLabels";

/** Sun/moon button: switches between the dark (default) and light themes. */
export function ThemeToggle() {
  const theme = usePreferencesStore((s) => s.preferences.theme);
  const toggleTheme = usePreferencesStore((s) => s.toggleTheme);
  return (
    <IconButton
      label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
      icon={theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      onClick={toggleTheme}
    />
  );
}

/** List of the 6 palettes with their first series colors (current theme). */
export function PaletteOptions({ onPick }: { onPick?: () => void }) {
  const { theme, palette: active } = usePreferencesStore((s) => s.preferences);
  const setPalette = usePreferencesStore((s) => s.setPalette);
  return (
    <ul className="flex flex-col gap-0.5" aria-label="Paletas">
      {PALETTES.map((palette) => (
        <li key={palette}>
          <button
            type="button"
            aria-pressed={palette === active}
            onClick={() => {
              setPalette(palette);
              onPick?.();
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm text-ink transition hover:bg-surface-2",
              palette === active && "bg-surface-2",
            )}
          >
            <span className="flex -space-x-1" aria-hidden>
              {seriesColors(palette, theme)
                .slice(0, 4)
                .map((color) => (
                  <span
                    key={color}
                    className="size-4 rounded-full ring-2 ring-surface"
                    style={{ background: color }}
                  />
                ))}
            </span>
            <span className="flex-1">{PALETTE_LABELS[palette]}</span>
            {palette === active && (
              <Check size={16} className="text-accent" aria-hidden />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Palette picker in a popover. */
export function PaletteMenu() {
  return (
    <Popover
      label="Paleta de cores"
      trigger={(props) => (
        <IconButton
          {...props}
          label="Paleta de cores"
          icon={<PaletteIcon size={18} />}
        />
      )}
    >
      {(close) => <PaletteOptions onPick={close} />}
    </Popover>
  );
}
