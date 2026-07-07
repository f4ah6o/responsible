import { Component, type ContextType, type ErrorInfo, type ReactNode } from "react";

import { LocaleContext } from "./i18n";

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
  static override contextType = LocaleContext;
  declare context: ContextType<typeof LocaleContext>;
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
    const { t } = this.context;

    return (
      <div className="fatal-error" role="alert">
        <h1>{t("fatalErrorTitle")}</h1>
        <p className="fatal-error-message">{error.message}</p>
        <button type="button" className="primary-action" onClick={() => location.reload()}>
          {t("reload")}
        </button>
      </div>
    );
  }
}
