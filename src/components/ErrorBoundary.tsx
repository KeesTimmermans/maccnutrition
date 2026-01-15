import React from "react";

import { Button } from "@/components/ui/button";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep console error for debugging in production builds.
    console.error("Unhandled render error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isProd = import.meta.env.PROD;
    const message = this.state.error?.message ?? "Unknown error";

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-medium space-y-4">
          <header className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The app hit an unexpected error. Reload to try again.
            </p>
          </header>

          <div className="flex gap-3">
            <Button className="flex-1" variant="hero" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message);
                } catch {
                  // ignore
                }
              }}
            >
              Copy error
            </Button>
          </div>

          {!isProd && this.state.error ? (
            <pre className="max-h-48 overflow-auto rounded-xl bg-muted p-3 text-xs text-foreground whitespace-pre-wrap">
              {this.state.error.stack ?? message}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }
}
