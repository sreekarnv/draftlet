import { Link, Navigate } from "react-router";
import { Mail, MessageCircle, Settings } from "lucide-react";

import type { Conversation } from "@/lib/contracts";
import { useConversationsQuery } from "@/lib/queries/conversations";
import { Button } from "@/shared/components/ui/button";

function isMessageConversation(conversation: Conversation) {
  return conversation.connector === "telegram" || conversation.threadKind === "chat";
}

function isEmailConversation(conversation: Conversation) {
  return conversation.connector === "gmail" || conversation.threadKind === "email";
}

export function Home() {
  const conversationsQuery = useConversationsQuery();
  const conversations = conversationsQuery.data ?? [];
  const firstMessage = conversations.find(isMessageConversation);
  const firstEmail = conversations.find(isEmailConversation);

  if (firstMessage) {
    return <Navigate to={`/messages/${firstMessage.id}`} replace />;
  }

  if (firstEmail) {
    return <Navigate to={`/email/${firstEmail.id}`} replace />;
  }

  return (
    <section className="flex h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Draftlet
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
          Local-first drafting for messages and email.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Captured Telegram chats and Gmail threads stay local, then open directly into focused
          drafting context when they are available.
        </p>

        {conversationsQuery.isLoading ? (
          <div className="mt-6 h-9 w-40 rounded-md bg-muted" />
        ) : (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/messages">
                <MessageCircle className="size-4" />
                Messages
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/email">
                <Mail className="size-4" />
                Email
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/settings">
                <Settings className="size-4" />
                Settings
              </Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
