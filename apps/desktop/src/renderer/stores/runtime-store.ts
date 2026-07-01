import { create } from 'zustand';

import { RECOMMENDED_MODEL } from '../lib/constants';
import type { CommandStatus, InstalledModel, RuntimeState } from '../lib/types';

const UNKNOWN: CommandStatus = { ok: false, message: 'Not checked yet.', code: 'unknown' };

const initialState: RuntimeState = {
  ollamaInstalled: UNKNOWN,
  ollamaRunning: UNKNOWN,
  model: UNKNOWN,
  installedModels: [],
  selectedModel: RECOMMENDED_MODEL,
  server: UNKNOWN,
};

interface RuntimeStateStore extends RuntimeState {
  setRuntime: (state: RuntimeState) => void;
}

export const useRuntimeStore = create<RuntimeStateStore>((set) => ({
  ...initialState,
  setRuntime: (runtime) => set(runtime),
}));
