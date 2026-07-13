import "@/shared/styles/main.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router";
import { DefaultLayout } from "@/shared/components/layouts/default";
import { Connectors } from "@/routes/connectors";
import { ConversationDetail } from "@/routes/conversation-detail";
import { Diagnostics } from "@/routes/diagnostics";
import { DraftsIndex } from "@/routes/drafts-index";
import { DraftWorkspace } from "@/routes/draft-workspace";
import { Home } from "@/routes/home";
import { Library } from "@/routes/library";
import { Messages } from "@/routes/messages";
import { Search } from "@/routes/search";
import { Settings } from "@/routes/settings";
import { QueryProvider } from "@/shared/components/query-provider";

const router = createBrowserRouter([
  {
    path: "/",
    Component: DefaultLayout,
    children: [
      { index: true, Component: Home },
      { path: "messages", Component: Messages },
      { path: "messages/:conversationId", Component: Messages },
      { path: "library", Component: Library },
      { path: "library/:conversationId", Component: ConversationDetail },
      { path: "drafts", Component: DraftsIndex },
      { path: "drafts/:draftId", Component: DraftWorkspace },
      { path: "connectors", Component: Connectors },
      { path: "search", Component: Search },
      { path: "settings", Component: Settings },
      { path: "diagnostics", Component: Diagnostics },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  </React.StrictMode>,
);
