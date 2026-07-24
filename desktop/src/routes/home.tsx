import { Link } from "react-router";
import { Mail, MessageCircle, Settings } from "lucide-react";

import { useConversationsQuery } from "@/lib/queries/conversations";
import { Button } from "@/shared/components/ui/button";

export function Home() {
  const conversationsQuery = useConversationsQuery();

  return (
    <section className="bg-background flex h-full items-center justify-center p-6">
      <div className="bg-card text-card-foreground w-full max-w-xl rounded-2xl border p-6 shadow-sm">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
          Draftlet
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
          Local-first drafting for messages and email.
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-6">
          Captured Telegram chats and Gmail threads stay local, then open directly into focused
          drafting context when they are available.
        </p>

        {conversationsQuery.isLoading ? (
          <div className="bg-muted mt-6 h-9 w-40 rounded-md" />
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
