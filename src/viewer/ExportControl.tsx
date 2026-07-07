import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";

import {
  buildExportFileName,
  captureFlowImage,
  downloadDataUrl,
  waitForFrames,
  type ExportFormat,
} from "./exportImage";
import { useI18n } from "./i18n";

export type ExportControlProps = {
  containerRef: React.RefObject<HTMLElement | null>;
  processName: string;
  boundaryLabel: string;
  disabled?: boolean;
};

const FORMAT_LABELS: Record<ExportFormat, string> = { svg: "SVG", png: "PNG" };

export function ExportControl({
  containerRef,
  processName,
  boundaryLabel,
  disabled,
}: ExportControlProps) {
  const { t } = useI18n();
  const { getNodes } = useReactFlow();
  const [exporting, setExporting] = useState<ExportFormat | undefined>();
  const [error, setError] = useState<string | undefined>();

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      const viewportEl = containerRef.current?.querySelector<HTMLElement>(".react-flow__viewport");
      if (!viewportEl) return;

      setExporting(format);
      setError(undefined);
      try {
        // Let any in-flight card-size measurement flush before capturing.
        await waitForFrames(2);
        const dataUrl = await captureFlowImage(viewportEl, getNodes(), format);
        downloadDataUrl(dataUrl, buildExportFileName(processName, boundaryLabel, format));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setExporting(undefined);
      }
    },
    [containerRef, getNodes, processName, boundaryLabel],
  );

  return (
    <section className="export-control" aria-label={t("exportAriaLabel")}>
      {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((format) => (
        <button
          key={format}
          type="button"
          className="secondary-action"
          disabled={disabled || exporting !== undefined}
          onClick={() => void handleExport(format)}
        >
          {exporting === format ? t("exporting") : FORMAT_LABELS[format]}
        </button>
      ))}
      {error && (
        <span className="export-error" role="alert">
          {error}
        </span>
      )}
    </section>
  );
}
