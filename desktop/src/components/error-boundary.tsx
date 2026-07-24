import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";

interface DefaultErrorFallbackProps {
  error: Error;
  onReset: () => void;
}

export function DefaultErrorFallback({ error, onReset }: DefaultErrorFallbackProps) {
  return (
    <section className="bg-background flex min-h-full items-center justify-center p-6">
      <div className="bg-card text-card-foreground max-w-md rounded-xl border border-dashed p-6 text-center shadow-sm">
        <p className="text-sm font-semibold">Something went wrong</p>
        <p className="text-muted-foreground mt-2 text-xs leading-5">
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

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

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
