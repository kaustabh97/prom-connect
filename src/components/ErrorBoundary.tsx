import { Component, type ReactNode } from "react";
import { logError } from "@/utils/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError(error, { component: "ErrorBoundary", operation: "componentDidCatch", extra: { componentStack: errorInfo.componentStack } });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-[hsl(222_47%_6%)] text-white">
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-white/80 mb-4 max-w-md text-center">
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-amber-500/80 hover:bg-amber-500 text-black font-medium"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
