import { create } from 'zustand';

interface AppStatusState {
  actionMessage: string;
  busy: boolean;
  setupComplete: boolean;
  setActionMessage: (message: string) => void;
  setBusy: (busy: boolean) => void;
  setSetupComplete: (complete: boolean) => void;
}

export const useAppStatusStore = create<AppStatusState>((set) => ({
  actionMessage: '',
  busy: false,
  setupComplete: false,
  setActionMessage: (actionMessage) => set({ actionMessage }),
  setBusy: (busy) => set({ busy }),
  setSetupComplete: (setupComplete) => set({ setupComplete }),
}));
