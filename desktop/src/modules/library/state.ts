import { type AnyAction } from "@/shared/types/any-action";
import { type LibraryFilter } from "@/modules/library/types";
import { type Conversation } from "@/lib/contracts";

export type SetActiveFilterAction = AnyAction<"set_active_filter", { filter: LibraryFilter }>;
export type SetQueryAction = AnyAction<"set_query", { query: string }>;
export type SetSelectedIdAction = AnyAction<"set_selected_id", { selectedId: string }>;

export type LibraryAction = SetActiveFilterAction | SetQueryAction | SetSelectedIdAction;

export type LibraryState = {
  activeFilter: LibraryFilter;
  query: string;
  selectedId: string;
  selectedConversation?: Conversation;
};

export const libraryReducer = (
  state: LibraryState,
  { payload, type: _type }: LibraryAction,
): LibraryState => {
  switch (_type) {
    case "set_active_filter":
      return {
        ...state,
        activeFilter: payload.filter,
      };

    case "set_query":
      return {
        ...state,
        query: payload.query,
      };

    case "set_selected_id":
      return {
        ...state,
        selectedId: payload.selectedId,
      };

    default:
      throw Error(`Unknown Action ${_type as string}`);
  }
};
