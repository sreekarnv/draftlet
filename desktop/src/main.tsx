import "@/shared/styles/main.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createHashRouter } from "react-router";
import { DefaultLayout } from "@/shared/components/layouts/default";
import { Connectors } from "@/routes/connectors";
import { ConversationDetail } from "@/routes/conversation-detail";
import { Diagnostics } from "@/routes/diagnostics";
import { DraftsIndex } from "@/routes/drafts-index";
import { DraftWorkspace } from "@/routes/draft-workspace";
import { Email } from "@/routes/email";
import { Home } from "@/routes/home";
import { Library } from "@/routes/library";
import { Messages } from "@/routes/messages";
import { Navigate } from "react-router";
import { Search } from "@/routes/search";
import { Settings } from "@/routes/settings";
import { QueryProvider } from "@/shared/components/query-provider";

const router = createHashRouter([
  {
    path: "/",
    Component: DefaultLayout,
    children: [
      { index: true, Component: Home },
      { path: "messages", Component: Messages },
      { path: "messages/:conversationId", Component: Messages },
      { path: "email", Component: Email },
      { path: "email/:conversationId", Component: Email },
      { path: "library", Component: Library },
      { path: "library/:conversationId", Component: ConversationDetail },
      { path: "drafts", Component: DraftsIndex },
      { path: "drafts/:draftId", Component: DraftWorkspace },
      { path: "connectors", Component: Connectors },
      { path: "search", Component: Search },
      { path: "settings", Component: Settings },
      { path: "diagnostics", Component: Diagnostics },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  </React.StrictMode>,
);
