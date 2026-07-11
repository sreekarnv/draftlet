import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/shared/components/ui/button";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (typeof console !== "undefined") {
      console.error("Draftlet render error:", error, info.componentStack);
    }
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }
    return <DefaultErrorFallback error={error} onReset={this.reset} />;
  }
}

function DefaultErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <section className="flex min-h-full items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-xl border border-dashed bg-card p-6 text-center text-card-foreground shadow-sm">
        <p className="text-sm font-semibold">Something went wrong</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {error.message || "An unexpected error occurred while rendering this view."}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button size="sm" onClick={onReset}>
            Try again
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
          >
            Reload window
          </Button>
        </div>
      </div>
    </section>
  );
}
