import { create } from "zustand";

/** Transient UI state shared between the shell and the dashboard (not persisted). */
interface UiStore {
  galleryOpen: boolean;
  /** Widget open in the editor modal (#42). */
  editingWidgetId: string | null;
  openGallery: () => void;
  closeGallery: () => void;
  editWidget: (id: string) => void;
  closeEditor: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  galleryOpen: false,
  editingWidgetId: null,
  openGallery: () => {
    set({ galleryOpen: true });
  },
  closeGallery: () => {
    set({ galleryOpen: false });
  },
  editWidget: (id) => {
    set({ editingWidgetId: id });
  },
  closeEditor: () => {
    set({ editingWidgetId: null });
  },
}));
