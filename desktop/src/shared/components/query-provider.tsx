import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";

import { createQueryClient } from "@/lib/query-client";
import { RuntimeEvents } from "@/lib/runtime-events";

export function QueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <RuntimeEvents />
      {children}
    </QueryClientProvider>
  );
}
