import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error?: Error;
};

/**
 * Last-resort guard: keeps an unexpected render error from producing a blank
 * page and offers a reload path. Expected errors (model validation, v0
 * projection limits) are handled inside the viewer and never reach here.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("responsible viewer crashed", error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="fatal-error" role="alert">
        <h1>表示中にエラーが発生しました</h1>
        <p className="fatal-error-message">{error.message}</p>
        <button type="button" className="primary-action" onClick={() => location.reload()}>
          再読み込み
        </button>
      </div>
    );
  }
}
