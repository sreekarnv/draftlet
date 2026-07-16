import { create } from "zustand";

type State = {
  selectedLibraryConversationId: string;
};

type Actions = {
  setSelectedLibraryConversationId: (id: string) => void;
};

export type DraftletStore = State & Actions;

export const useDraftletStore = create<DraftletStore>()((set) => ({
  selectedLibraryConversationId: "",
  setSelectedLibraryConversationId: (selectedLibraryConversationId) =>
    set({ selectedLibraryConversationId }),
}));
