import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { useUiStore } from "../../stores/uiStore";
import { UserMenu } from "../auth/UserMenu";
import { Button, IconButton } from "../ui";
import { PaletteMenu, ThemeToggle } from "./appearance";
import { HistoryActions } from "./HistoryActions";
import { MobileMenu } from "./MobileMenu";
import { SaveIndicator } from "./SaveIndicator";

/** Gradient logo mark + name. */
export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5">
      <span className="bg-accent-gradient glow grid size-9 place-items-center rounded-xl text-on-accent">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path
            d="M4 18V6l8 9V6m4 12V6l4 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-accent-gradient text-base font-semibold">
          NY Dashboard
        </span>
        <span className="hidden text-xs text-muted sm:block">
          Táxis e apps de Nova York
        </span>
      </span>
    </Link>
  );
}

/**
 * Sticky glass header. Desktop: save status, history, add widget, theme, palette and user.
 * Mobile (< md): add + a menu with the rest. The filters row (`filters`) sits below.
 */
export function AppHeader({ filters }: { filters?: ReactNode }) {
  const openGallery = useUiStore((s) => s.openGallery);
  return (
    <header className="glass sticky top-0 z-40 border-b border-border">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-2 px-4">
        <Logo />
        <div className="flex-1" />
        <div className="hidden items-center gap-1 md:flex">
          <SaveIndicator className="mr-2" />
          <HistoryActions />
          <Button
            variant="primary"
            icon={<Plus size={18} />}
            onClick={openGallery}
            className="mx-2"
          >
            Adicionar widget
          </Button>
          <ThemeToggle />
          <PaletteMenu />
          <span className="mx-2 h-6 w-px bg-border" aria-hidden />
          <UserMenu />
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <IconButton
            variant="primary"
            label="Adicionar widget"
            icon={<Plus size={18} />}
            onClick={openGallery}
          />
          <MobileMenu />
          <UserMenu compact />
        </div>
      </div>
      {filters !== undefined && (
        <div className="mx-auto w-full max-w-[1600px] px-4 pb-3">{filters}</div>
      )}
    </header>
  );
}
