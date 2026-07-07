import { HIERARCHICAL_BOUNDARY_ORDER, canZoomIn, canZoomOut } from "../index.js";

export type BoundaryZoomControlProps = {
  level: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

const BOUNDARY_LABELS: Record<string, string> = {
  company: "会社",
  department: "部門",
  section: "課・セクション",
  team: "チーム",
  person: "担当者",
};

export function boundaryLabelFor(level: number): string {
  const key = HIERARCHICAL_BOUNDARY_ORDER[level] ?? "—";
  return BOUNDARY_LABELS[key] ?? key;
}

export function BoundaryZoomControl({ level, onZoomIn, onZoomOut }: BoundaryZoomControlProps) {
  const label = boundaryLabelFor(level);
  const ordinal = level + 1;
  const total = HIERARCHICAL_BOUNDARY_ORDER.length;
  const canIn = canZoomIn(level);
  const canOut = canZoomOut(level);

  return (
    <section className="zoom-bar" aria-label="責任境界ズーム">
      <button className="secondary-action" onClick={onZoomOut} disabled={!canOut}>
        粗く見る
      </button>
      <div className="zoom-scope">
        <span>境界ズーム</span>
        <strong>{label}</strong>
        <small>
          レベル {ordinal}/{total}
        </small>
      </div>
      <button className="primary-action" onClick={onZoomIn} disabled={!canIn}>
        詳しく見る
      </button>
    </section>
  );
}
