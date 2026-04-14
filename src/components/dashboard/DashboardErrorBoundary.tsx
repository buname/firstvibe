"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BEX dashboard]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="font-mono text-xs font-bold tracking-wider text-red-400/90">
            TAB CRASHED
          </p>
          <p className="max-w-md font-mono text-[10px] leading-relaxed text-neutral-500">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded border border-[#333] px-3 py-1.5 font-mono text-[10px] text-[#a3a3a3] hover:bg-[#161616] hover:text-white"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
