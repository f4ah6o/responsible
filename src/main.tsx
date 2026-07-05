import "./styles.css";
import "@xyflow/react/dist/style.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ErrorBoundary } from "./viewer/ErrorBoundary.js";
import { ProcessViewer } from "./viewer/ProcessViewer.js";

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (!rootElement) throw new Error("#app is required");

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <ProcessViewer />
    </ErrorBoundary>
  </StrictMode>,
);
