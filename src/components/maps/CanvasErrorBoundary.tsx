"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type CanvasErrorBoundaryProps = {
  children: ReactNode;
};

type CanvasErrorBoundaryState = {
  hasError: boolean;
};

export default class CanvasErrorBoundary extends Component<
  CanvasErrorBoundaryProps,
  CanvasErrorBoundaryState
> {
  state: CanvasErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): CanvasErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Canvas render failure", error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/80 text-xs text-white/70">
          Canvas initialization failed. Please refresh.
        </div>
      );
    }
    return this.props.children;
  }
}
