import { HIERARCHICAL_BOUNDARY_ORDER, canZoomIn, canZoomOut } from "../index.js";

export type HeightMode = "estimated" | "measured";

export type BoundaryZoomControlProps = {
  level: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  heightMode: HeightMode;
  onToggleHeightMode: () => void;
};

const BOUNDARY_LABELS: Record<string, string> = {
  company: "会社",
  department: "部門",
  section: "課・セクション",
  team: "チーム",
  person: "担当者",
};

export function BoundaryZoomControl({ level, onZoomIn, onZoomOut, heightMode, onToggleHeightMode }: BoundaryZoomControlProps) {
  const key = HIERARCHICAL_BOUNDARY_ORDER[level] ?? "—";
  const label = BOUNDARY_LABELS[key] ?? key;
  const ordinal = level + 1;
  const total = HIERARCHICAL_BOUNDARY_ORDER.length;
  const canIn = canZoomIn(level);
  const canOut = canZoomOut(level);

  return (
    <section className="zoom-bar overlay-top-right" aria-label="責任境界ズーム">
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
      <button
        className="secondary-action height-mode-toggle"
        onClick={onToggleHeightMode}
        title={heightMode === "estimated" ? "推定モード（クリックで計測モードへ）" : "計測モード（クリックで推定モードへ）"}
      >
        {heightMode === "estimated" ? "推定" : "計測"}
      </button>
    </section>
  );
}
