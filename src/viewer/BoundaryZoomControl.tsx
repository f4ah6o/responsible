import { HIERARCHICAL_BOUNDARY_ORDER, canZoomIn, canZoomOut } from "../index.js";

export type BoundaryZoomControlProps = {
  level: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function BoundaryZoomControl({ level, onZoomIn, onZoomOut }: BoundaryZoomControlProps) {
  const label = HIERARCHICAL_BOUNDARY_ORDER[level] ?? "—";
  const ordinal = level + 1;
  const total = HIERARCHICAL_BOUNDARY_ORDER.length;
  const canIn = canZoomIn(level);
  const canOut = canZoomOut(level);

  return (
    <section className="zoom-bar" aria-label="Responsibility boundary zoom">
      <button className="secondary-action" onClick={onZoomOut} disabled={!canOut}>
        Zoom out
      </button>
      <div className="zoom-scope">
        <span>boundary zoom</span>
        <strong>{label}</strong>
        <small>
          level {ordinal}/{total}
        </small>
      </div>
      <button className="primary-action" onClick={onZoomIn} disabled={!canIn}>
        Zoom in
      </button>
    </section>
  );
}
