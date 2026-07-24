import * as React from "react";

import { cn } from "@/shared/lib/utils";

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-1.5", className)} {...props} />;
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-muted-foreground text-xs leading-5", className)} {...props} />;
}

function FieldError({ className, children, ...props }: React.ComponentProps<"p">) {
  if (!children) return null;
  return (
    <p className={cn("text-destructive text-xs font-medium", className)} {...props}>
      {children}
    </p>
  );
}

export { Field, FieldDescription, FieldError, FieldLabel };
