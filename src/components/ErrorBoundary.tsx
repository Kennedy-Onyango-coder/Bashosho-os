import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  // Explicit properties for strict environments
  state: State;
  props: Props;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error inside Bashosho OS boundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white border border-red-200 rounded-2xl p-6 text-left space-y-4 max-w-xl mx-auto shadow-sm my-6">
          <div className="flex items-center gap-3 border-b pb-3 border-neutral-100">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <div>
              <h3 className="text-sm font-black text-neutral-900 uppercase tracking-tight">
                {this.props.fallbackTitle || "An unexpected error occurred"}
              </h3>
              <p className="text-[10px] text-neutral-500 font-mono">BASHOSHO OS SHIELD INTERPOLATED</p>
            </div>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed font-sans">
            A component failed to render due to a client-side exception. This can happen if state or seed data has mismatched field schemas during migration. You can reload the app, or clear storage to restore functional integrity.
          </p>
          {this.state.error && (
            <pre className="text-[10px] bg-neutral-900 text-red-400 p-3.5 rounded-xl overflow-x-auto font-mono leading-relaxed border border-red-950 max-h-40">
              {this.state.error.toString()}
            </pre>
          )}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => window.location.reload()}
              className="bg-[#E31E24] hover:bg-[#c21419] text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
