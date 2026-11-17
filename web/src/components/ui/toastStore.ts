import { create } from "zustand";

export type ToastTone = "info" | "success" | "error";

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  /** Auto-dismiss after this many ms (0 = sticky). */
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (
    toast: Omit<ToastItem, "id" | "duration"> & { duration?: number },
  ) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ duration = 4000, ...toast }) => {
    const id = nextId++;
    set((state) => ({
      toasts: [...state.toasts, { id, duration, ...toast }].slice(-4),
    }));
    return id;
  },
  dismiss: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
}));

/** `toast.success("Salvo")` from anywhere (also outside React). */
export const toast = {
  info: (message: string) =>
    useToastStore.getState().push({ tone: "info", message }),
  success: (message: string) =>
    useToastStore.getState().push({ tone: "success", message }),
  error: (message: string) =>
    useToastStore.getState().push({ tone: "error", message, duration: 6000 }),
};
