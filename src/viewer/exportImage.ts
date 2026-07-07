import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";

export type ExportFormat = "svg" | "png";

const EXPORT_PADDING = 0.05;
const EXPORT_MIN_ZOOM = 0.1;
const EXPORT_MAX_ZOOM = 2;
const PNG_PIXEL_RATIO = 2;

const FILE_NAME_UNSAFE = /[\\/:*?"<>|\s]+/g;

function sanitizeFileNamePart(part: string): string {
  const cleaned = part
    .trim()
    .replace(FILE_NAME_UNSAFE, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "untitled";
}

export function buildExportFileName(
  processName: string,
  boundaryLabel: string,
  format: ExportFormat,
): string {
  return `${sanitizeFileNamePart(processName)}-${sanitizeFileNamePart(boundaryLabel)}.${format}`;
}

// Sizes the export to the actual content bounds (not a fixed panel size) so
// diagrams of any scale stay legible instead of being shrunk to fit a fixed frame.
export async function captureFlowImage(
  viewportEl: HTMLElement,
  nodes: Node[],
  format: ExportFormat,
): Promise<string> {
  const bounds = getNodesBounds(nodes);
  const width = Math.max(1, Math.ceil(bounds.width));
  const height = Math.max(1, Math.ceil(bounds.height));
  const { x, y, zoom } = getViewportForBounds(
    bounds,
    width,
    height,
    EXPORT_MIN_ZOOM,
    EXPORT_MAX_ZOOM,
    EXPORT_PADDING,
  );

  const options = {
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${x}px, ${y}px) scale(${zoom})`,
    },
  };

  return format === "svg"
    ? toSvg(viewportEl, options)
    : toPng(viewportEl, { ...options, pixelRatio: PNG_PIXEL_RATIO });
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  // Some browsers ignore the `download` attribute (falling back to a generic
  // name) unless the anchor is attached to the document when clicked. Defer
  // removal so the browser's async download handling can still read it.
  document.body.appendChild(link);
  link.click();
  setTimeout(() => link.remove(), 0);
}

// Measured card sizes flush via requestAnimationFrame (SizeReportContext); waiting
// a couple of frames before capture avoids exporting a layout mid-flush after a
// boundary zoom or drill-down change.
export function waitForFrames(count: number): Promise<void> {
  if (count <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve())).then(() =>
    waitForFrames(count - 1),
  );
}
