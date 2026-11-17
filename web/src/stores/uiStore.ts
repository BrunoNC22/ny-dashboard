import { create } from "zustand";

/** Transient UI state shared between the shell and the dashboard (not persisted). */
interface UiStore {
  galleryOpen: boolean;
  openGallery: () => void;
  closeGallery: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  galleryOpen: false,
  openGallery: () => {
    set({ galleryOpen: true });
  },
  closeGallery: () => {
    set({ galleryOpen: false });
  },
}));
